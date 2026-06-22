package com.flowstate.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mediapipe.tasks.genai.llminference.AudioModelOptions;
import com.google.mediapipe.tasks.genai.llminference.GraphOptions;
import com.google.mediapipe.tasks.genai.llminference.LlmInference;
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions;
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession;
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession.LlmInferenceSessionOptions;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "AndroidGemmaTranscription")
public class AndroidGemmaTranscriptionPlugin extends Plugin {
    private static final String PREFS_NAME = "flowstate_android_gemma";
    private static final String MODEL_PATH_KEY = "model_path";
    private static final String DEFAULT_PROMPT = "Transcribe the following FlowState task capture. Preserve Hebrew and English words exactly.";

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void setModelPath(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Model path is required.");
            return;
        }

        getPrefs().edit().putString(MODEL_PATH_KEY, path.trim()).apply();
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void importModel(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.trim().isEmpty()) {
            call.reject("Model URI is required.");
            return;
        }

        try {
            File modelFile = copyModelToAppStorage(Uri.parse(uriValue));
            getPrefs().edit().putString(MODEL_PATH_KEY, modelFile.getAbsolutePath()).apply();
            call.resolve(buildStatus());
        } catch (Exception error) {
            call.reject("Failed to import Android Gemma model: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void transcribe(PluginCall call) {
        String modelPath = getModelPath();
        if (modelPath == null) {
            call.reject("Android Gemma model path is not configured.");
            return;
        }
        if (!new File(modelPath).exists()) {
            call.reject("Android Gemma model file does not exist at " + modelPath);
            return;
        }

        String mimeType = call.getString("mimeType", "");
        if (!mimeType.toLowerCase().contains("wav")) {
            call.reject("Android Gemma requires mono WAV audio. Received " + (mimeType.isEmpty() ? "unknown audio type" : mimeType) + ".");
            return;
        }

        String audioBase64 = call.getString("audioBase64");
        if (audioBase64 == null || audioBase64.isEmpty()) {
            call.reject("Audio data is required.");
            return;
        }

        String prompt = call.getString("prompt", DEFAULT_PROMPT);
        try {
            byte[] audioBytes = Base64.decode(audioBase64, Base64.DEFAULT);
            if (!isWav(audioBytes)) {
                call.reject("Android Gemma requires mono WAV audio with a RIFF/WAVE header.");
                return;
            }

            String transcript = transcribeWav(modelPath, prompt, audioBytes).trim();
            JSObject result = new JSObject();
            result.put("transcript", transcript);
            result.put("language", "unknown");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android Gemma transcription failed: " + error.getMessage(), error);
        }
    }

    private String transcribeWav(String modelPath, String prompt, byte[] audioBytes) throws Exception {
        LlmInferenceOptions inferenceOptions = LlmInferenceOptions.builder()
            .setModelPath(modelPath)
            .setMaxTokens(512)
            .setAudioModelOptions(AudioModelOptions.builder().build())
            .build();

        LlmInferenceSessionOptions sessionOptions = LlmInferenceSessionOptions.builder()
            .setGraphOptions(GraphOptions.builder().setEnableAudioModality(true).build())
            .build();

        try (
            LlmInference llmInference = LlmInference.createFromOptions(getContext(), inferenceOptions);
            LlmInferenceSession session = LlmInferenceSession.createFromOptions(llmInference, sessionOptions)
        ) {
            session.addQueryChunk(prompt);
            session.addAudio(audioBytes);
            return session.generateResponse();
        }
    }

    private File copyModelToAppStorage(Uri uri) throws Exception {
        File modelDir = new File(getContext().getFilesDir(), "gemma-models");
        if (!modelDir.exists() && !modelDir.mkdirs()) {
            throw new IllegalStateException("Could not create model storage directory.");
        }

        File modelFile = new File(modelDir, "flowstate-gemma-model.task");
        try (
            InputStream input = getContext().getContentResolver().openInputStream(uri);
            FileOutputStream output = new FileOutputStream(modelFile)
        ) {
            if (input == null) {
                throw new IllegalArgumentException("Could not open selected model URI.");
            }
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }

        return modelFile;
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        String modelPath = getModelPath();
        boolean modelConfigured = modelPath != null;
        boolean modelExists = modelConfigured && new File(modelPath).exists();

        status.put("available", modelExists);
        status.put("modelConfigured", modelConfigured);
        status.put("modelPath", modelPath);
        if (!modelConfigured) {
            status.put("reason", "Set or import a FlowState-accessible Gemma .task/.litertlm model before enabling local Android transcription.");
        } else if (!modelExists) {
            status.put("reason", "Android Gemma model file is not readable at " + modelPath);
        }
        return status;
    }

    private boolean isWav(byte[] bytes) {
        return bytes.length >= 12
            && bytes[0] == 'R'
            && bytes[1] == 'I'
            && bytes[2] == 'F'
            && bytes[3] == 'F'
            && bytes[8] == 'W'
            && bytes[9] == 'A'
            && bytes[10] == 'V'
            && bytes[11] == 'E';
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String getModelPath() {
        String path = getPrefs().getString(MODEL_PATH_KEY, null);
        return path == null || path.trim().isEmpty() ? null : path.trim();
    }
}
