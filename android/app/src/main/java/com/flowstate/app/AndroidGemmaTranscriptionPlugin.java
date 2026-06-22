package com.flowstate.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidGemmaTranscription")
public class AndroidGemmaTranscriptionPlugin extends Plugin {
    private static final String PREFS_NAME = "flowstate_android_gemma";
    private static final String MODEL_URI_KEY = "model_uri";

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void importModel(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Model URI is required.");
            return;
        }

        getPrefs().edit().putString(MODEL_URI_KEY, uri).apply();
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void transcribe(PluginCall call) {
        call.reject("Android Gemma native transcription runtime is not bundled in this build.");
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        boolean modelConfigured = getModelUri() != null;
        status.put("available", false);
        status.put("modelConfigured", modelConfigured);
        status.put(
            "reason",
            modelConfigured
                ? "Model URI is configured, but MediaPipe/Gemma inference is not bundled in this build."
                : "Import a FlowState-accessible Gemma model before enabling local Android transcription."
        );
        return status;
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String getModelUri() {
        String uri = getPrefs().getString(MODEL_URI_KEY, null);
        return uri == null || uri.trim().isEmpty() ? null : uri;
    }
}
