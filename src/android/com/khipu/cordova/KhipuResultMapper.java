package com.khipu.cordova;

import com.khipu.client.KhipuEvent;
import com.khipu.client.KhipuResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Turns the SDK's result into the object a merchant's JavaScript receives.
 *
 * This used to be khipuResult.asJson(), which has two problems. It returns a String, so
 * Android handed JavaScript a string where iOS handed it an object. And it is
 * Gson().toJson(this) with serializeNulls off, so the three nullable fields produced no
 * key at all rather than a null one.
 *
 * The eight keys below are the same eight, in the same shape, that KhipuPlugin.swift
 * builds. scripts/check-option-keys.js reads both and fails if they stop matching.
 */
final class KhipuResultMapper {

    private KhipuResultMapper() {
    }

    static JSONObject toJson(KhipuResult result) throws JSONException {
        JSONObject json = new JSONObject();

        json.put("operationId", result.getOperationId());
        json.put("result", result.getResult());
        json.put("exitTitle", result.getExitTitle());
        json.put("exitMessage", result.getExitMessage());
        json.put("exitUrl", orJsonNull(result.getExitUrl()));
        json.put("failureReason", orJsonNull(result.getFailureReason()));
        json.put("continueUrl", orJsonNull(result.getContinueUrl()));

        JSONArray events = new JSONArray();
        for (KhipuEvent event : result.getEvents()) {
            events.put(new JSONObject()
                    .put("name", event.getName())
                    .put("type", event.getType())
                    .put("timestamp", event.getTimestamp()));
        }
        json.put("events", events);

        return json;
    }

    /** True when the operation failed, which is the only case the merchant gets as an error. */
    static boolean isError(KhipuResult result) {
        return "ERROR".equals(result.getResult());
    }

    // JSONObject.put with a plain Java null REMOVES the key. Passing JSONObject.NULL is
    // what keeps it present and makes it arrive in JavaScript as null, which is what iOS
    // sends and what the README documents.
    private static Object orJsonNull(String value) {
        return value == null ? JSONObject.NULL : value;
    }
}
