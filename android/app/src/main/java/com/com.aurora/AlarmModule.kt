package com.aurora

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.DisplayMetrics
import android.view.View
import android.view.WindowInsets
import android.provider.Settings
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.sqrt

class AlarmModule(private val rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc), SensorEventListener {
    private var lastShake = 0L
    private var preview: MediaPlayer? = null
    private var pickerPromise: Promise? = null

    private val activityListener = object : BaseActivityEventListener() {
        @Suppress("DEPRECATION")
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != PICK_REQUEST) return
            val p = pickerPromise ?: return
            pickerPromise = null
            if (resultCode != Activity.RESULT_OK || data == null) { p.resolve(null); return }
            val uri: Uri? = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
            val map = Arguments.createMap()
            if (uri == null) {
                map.putString("uri", "")
                map.putString("title", "Default alarm tone")
            } else {
                var title = "Phone ringtone"
                try { title = RingtoneManager.getRingtone(rc, uri)?.getTitle(rc) ?: title } catch (e: Exception) { }
                map.putString("uri", uri.toString())
                map.putString("title", title)
            }
            p.resolve(map)
        }
    }

    init { rc.addActivityEventListener(activityListener) }

    override fun getName() = "AuroraAlarm"

    private fun prefs() = rc.getSharedPreferences("native", Context.MODE_PRIVATE)

    // ---------------- alarms ----------------
    @ReactMethod
    fun schedule(id: Int, at: Double, label: String, h: Int, m: Int, days: ReadableArray, sound: String, vibrate: Boolean, promise: Promise) {
        try {
            val arr = JSONArray()
            for (i in 0 until days.size()) arr.put(days.getInt(i))
            val obj = JSONObject().put("id", id).put("at", at.toLong()).put("label", label)
                .put("h", h).put("m", m).put("days", arr).put("sound", sound).put("vibrate", vibrate)
            Scheduler.set(rc, obj)
            prefs().edit().putString("alarm_$id", obj.toString()).apply()
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("ANDROID_ALARM", e.message, e) }
    }

    @ReactMethod
    fun cancel(id: Int, promise: Promise) {
        try {
            Scheduler.cancel(rc, id)
            prefs().edit().remove("alarm_$id").apply()
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("ANDROID_ALARM", e.message, e) }
    }

    @ReactMethod
    fun snooze(id: Int, at: Double, promise: Promise) {
        try {
            val p = prefs()
            val raw = p.getString("alarm_$id", null) ?: throw IllegalStateException("Alarm missing")
            val obj = JSONObject(raw).put("at", at.toLong())
            Scheduler.set(rc, obj, true)
            p.edit().putString("snooze_$id", obj.toString()).apply()
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("ANDROID_ALARM", e.message, e) }
    }

    @ReactMethod
    fun ringing(promise: Promise) { promise.resolve(prefs().getInt("ringing", -1)) }

    @ReactMethod
    fun stop(promise: Promise) {
        rc.stopService(Intent(rc, AlarmSoundService::class.java))
        prefs().edit().putInt("ringing", -1).apply()
        promise.resolve(null)
    }

    // ---------------- sounds ----------------
    @ReactMethod
    fun previewSound(sound: String, promise: Promise) {
        try {
            stopPreviewInternal()
            val uri = resolveSoundUri(rc, sound) ?: throw IllegalStateException("No sound")
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.setDataSource(rc, uri)
            mp.isLooping = false
            mp.setOnCompletionListener { player ->
                player.release()
                if (preview === player) preview = null
            }
            mp.prepare()
            mp.start()
            preview = mp
            promise.resolve(true)
        } catch (e: Exception) {
            stopPreviewInternal()
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopPreview(promise: Promise) {
        stopPreviewInternal()
        promise.resolve(null)
    }

    private fun stopPreviewInternal() {
        try { preview?.release() } catch (e: Exception) { }
        preview = null
    }

    @ReactMethod
    fun pickSound(current: String, promise: Promise) {
        val act = rc.currentActivity
        if (act == null) { promise.reject("NO_ACTIVITY", "No active screen"); return }
        try {
            val i = Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Alarm sound")
            if (current.startsWith("content://"))
                i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(current))
            pickerPromise = promise
            act.startActivityForResult(i, PICK_REQUEST)
        } catch (e: Exception) {
            pickerPromise = null
            promise.reject("PICKER", e.message, e)
        }
    }

    // ---------------- permissions ----------------
    @ReactMethod
    fun permissionStatus(promise: Promise) {
        val am = rc.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val nm = rc.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val map = Arguments.createMap()
        map.putBoolean("exact", Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms())
        map.putBoolean("fullScreen", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent())
        promise.resolve(map)
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 31)
            rc.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${rc.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(null)
    }

    @ReactMethod
    fun openFullScreenSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT >= 34)
            rc.startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${rc.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(null)
    }

    // ---------------- safe-area insets (status bar / navigation bar / cutout) ----------------
    // Returns, in dp, how far the app content really extends underneath each system bar, so the
    // JS layout can pad exactly that amount (3-button nav, gesture nav, edge-to-edge, notches).
    // WindowInsets can report 0 on some phones/Android versions, so the real system bar sizes
    // from the framework resources are used as a fallback.
    @Suppress("DEPRECATION")
    @ReactMethod
    fun getInsets(promise: Promise) {
        val act = rc.currentActivity
        if (act == null) { promise.resolve(null); return }
        act.runOnUiThread {
            try {
                val content = act.findViewById<View>(android.R.id.content)
                if (content == null || content.height <= 0) {
                    promise.resolve(null)
                } else {
                    val res = rc.resources
                    fun sysDim(name: String): Int {
                        val id = res.getIdentifier(name, "dimen", "android")
                        return if (id > 0) res.getDimensionPixelSize(id) else 0
                    }

                    // 1) what WindowInsets says (may be 0)
                    var wiTop = 0
                    var wiBottom = 0
                    var wiLeft = 0
                    var wiRight = 0
                    val wi = act.window.decorView.rootWindowInsets
                    if (wi != null) {
                        if (Build.VERSION.SDK_INT >= 30) {
                            val b = wi.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                            wiTop = b.top; wiBottom = b.bottom; wiLeft = b.left; wiRight = b.right
                        } else {
                            wiTop = wi.stableInsetTop; wiBottom = wi.stableInsetBottom
                            wiLeft = wi.stableInsetLeft; wiRight = wi.stableInsetRight
                        }
                    }

                    // 2) real system bar sizes from the framework resources
                    val navMode = try { Settings.Secure.getInt(rc.contentResolver, "navigation_mode", 0) } catch (e: Exception) { 0 }
                    val resNav = if (navMode == 2) sysDim("navigation_bar_gesture_height") else sysDim("navigation_bar_height")
                    val top = maxOf(wiTop, sysDim("status_bar_height"))
                    val bottom = if (wiBottom > 0) wiBottom else resNav
                    val left = wiLeft
                    val right = wiRight

                    // 3) how much of each bar the content actually covers
                    val dm = DisplayMetrics()
                    act.windowManager.defaultDisplay.getRealMetrics(dm)
                    val loc = IntArray(2)
                    content.getLocationOnScreen(loc)
                    val ovTop = minOf(top, maxOf(0, top - loc[1]))
                    val ovBottom = minOf(bottom, maxOf(0, (loc[1] + content.height) - (dm.heightPixels - bottom)))
                    val ovLeft = minOf(left, maxOf(0, left - loc[0]))
                    val ovRight = minOf(right, maxOf(0, (loc[0] + content.width) - (dm.widthPixels - right)))
                    val d = dm.density.toDouble()
                    val map = Arguments.createMap()
                    map.putDouble("top", ovTop / d)
                    map.putDouble("bottom", ovBottom / d)
                    map.putDouble("left", ovLeft / d)
                    map.putDouble("right", ovRight / d)
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }
    }

    // ---------------- real accelerometer shake (gravity removed) ----------------
    @ReactMethod
    fun startShake(promise: Promise) {
        val sm = rc.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
        if (sensor == null) { promise.resolve(false); return }
        sm.unregisterListener(this)
        promise.resolve(sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME))
    }

    @ReactMethod
    fun stopShake(promise: Promise) {
        (rc.getSystemService(Context.SENSOR_SERVICE) as SensorManager).unregisterListener(this)
        promise.resolve(null)
    }

    override fun onSensorChanged(e: SensorEvent) {
        val mag = sqrt(e.values[0] * e.values[0] + e.values[1] * e.values[1] + e.values[2] * e.values[2])
        val now = SystemClock.elapsedRealtime()
        if (mag > 15 && now - lastShake > 500) {
            lastShake = now
            rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("AuroraShake", null)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // Required by NativeEventEmitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    companion object { private const val PICK_REQUEST = 4711 }
}

class AlarmPackage : ReactPackage {
    override fun createNativeModules(rc: ReactApplicationContext): List<NativeModule> = listOf(AlarmModule(rc))
    override fun createViewManagers(rc: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
