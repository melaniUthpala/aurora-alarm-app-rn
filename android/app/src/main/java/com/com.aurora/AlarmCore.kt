package com.aurora

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.AlarmManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import org.json.JSONObject
import java.util.Calendar

/** "" = default alarm tone, "raw:name" = built-in tone, anything else = a content:// URI */
fun resolveSoundUri(c: Context, sound: String?): Uri? {
    if (sound.isNullOrEmpty())
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    if (sound.startsWith("raw:"))
        return Uri.parse("android.resource://" + c.packageName + "/raw/" + sound.removePrefix("raw:"))
    return Uri.parse(sound)
}

object Scheduler {
    fun pending(c: Context, id: Int, snooze: Boolean = false): PendingIntent =
        PendingIntent.getBroadcast(
            c,
            if (snooze) id xor 0x40000000 else id,
            Intent(c, AlarmReceiver::class.java).putExtra("id", id).putExtra("snooze", snooze),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    fun set(c: Context, o: JSONObject, snooze: Boolean = false) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms())
            throw SecurityException("Allow Alarms & reminders in Android settings")
        val show = PendingIntent.getActivity(
            c, o.getInt("id"), Intent(c, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setAlarmClock(AlarmManager.AlarmClockInfo(o.getLong("at"), show), pending(c, o.getInt("id"), snooze))
    }

    fun cancel(c: Context, id: Int) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pending(c, id))
        am.cancel(pending(c, id, true))
        c.getSharedPreferences("native", 0).edit().remove("snooze_$id").apply()
    }

    /** Next occurrence for a repeating alarm, or null for a one-shot. */
    fun next(o: JSONObject): Long? {
        val days = o.getJSONArray("days")
        if (days.length() == 0) return null
        val now = System.currentTimeMillis()
        for (i in 0..7) {
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_YEAR, i)
            cal.set(Calendar.HOUR_OF_DAY, o.getInt("h"))
            cal.set(Calendar.MINUTE, o.getInt("m"))
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            val weekday = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1 // Mon=1 .. Sun=7
            if (cal.timeInMillis > now && (0 until days.length()).any { days.getInt(it) == weekday })
                return cal.timeInMillis
        }
        return null
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val p = c.getSharedPreferences("native", 0)

        // Reboot / clock change: restore every stored alarm
        if (i.action == Intent.ACTION_BOOT_COMPLETED || i.action == Intent.ACTION_TIME_CHANGED ||
            i.action == Intent.ACTION_TIMEZONE_CHANGED) {
            for ((key, value) in p.all) {
                if (!key.startsWith("alarm_") && !key.startsWith("snooze_")) continue
                try {
                    val o = JSONObject(value as String)
                    if (o.getLong("at") <= System.currentTimeMillis()) {
                        if (key.startsWith("snooze_")) { p.edit().remove(key).apply(); continue }
                        val next = Scheduler.next(o) ?: continue
                        o.put("at", next)
                        p.edit().putString(key, o.toString()).apply()
                    }
                    Scheduler.set(c, o, key.startsWith("snooze_"))
                } catch (e: Exception) { }
            }
            return
        }

        val id = i.getIntExtra("id", -1)
        val raw = p.getString("alarm_$id", null) ?: return
        val o = JSONObject(raw)
        if (i.getBooleanExtra("snooze", false)) {
            p.edit().remove("snooze_$id").apply()
        } else {
            val next = Scheduler.next(o)
            if (next != null) {
                o.put("at", next)
                try {
                    Scheduler.set(c, o)
                    p.edit().putString("alarm_$id", o.toString()).apply()
                } catch (e: Exception) { }
            }
        }
        p.edit().putInt("ringing", id).apply()
        val service = Intent(c, AlarmSoundService::class.java)
            .putExtra("label", o.optString("label", "Wake Up"))
            .putExtra("sound", o.optString("sound", ""))
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(service) else c.startService(service)
    }
}

class AlarmSoundService : Service() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(i: Intent?): IBinder? = null

    private fun startPlayer(uri: Uri?): Boolean {
        if (uri == null) return false
        return try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.setDataSource(this, uri)
            mp.isLooping = true
            mp.prepare()
            mp.start()
            player = mp
            true
        } catch (e: Exception) {
            player?.release()
            player = null
            false
        }
    }

    override fun onStartCommand(i: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel("aurora_ring", "Ringing alarms", NotificationManager.IMPORTANCE_HIGH)
            channel.setSound(null, null)
            channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            nm.createNotificationChannel(channel)
        }
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "aurora_ring") else Notification.Builder(this)
        val n = b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(i?.getStringExtra("label") ?: "AURORA")
            .setContentText("Tap to open AURORA")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .build()
        startForeground(909, n)

        player?.release()
        player = null
        val wanted = i?.getStringExtra("sound")
        if (!startPlayer(resolveSoundUri(this, wanted))) startPlayer(resolveSoundUri(this, ""))

        vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= 26) {
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 500), 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 600, 500), 0)
        }

        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ stopSelf() }, 10 * 60 * 1000L) // 10-minute safety timeout
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        player?.release()
        vibrator?.cancel()
        getSharedPreferences("native", 0).edit().putInt("ringing", -1).apply()
        super.onDestroy()
    }
}
