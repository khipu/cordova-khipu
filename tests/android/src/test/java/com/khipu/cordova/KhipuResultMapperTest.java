package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.khipu.client.KhipuEvent;
import com.khipu.client.KhipuResult;

import org.json.JSONObject;
import org.junit.Test;

/**
 * The eight keys iOS emits, emitted the same way here.
 *
 * KhipuResult's constructor takes its arguments in this order: operationId, exitTitle,
 * exitMessage, exitUrl, continueUrl, result, events, failureReason. Kotlin default
 * arguments are not visible from Java, so every one has to be passed.
 */
public class KhipuResultMapperTest {

    private static KhipuResult cancelled() {
        return new KhipuResult(
                "op-123",
                "",
                "",
                "",
                null,
                "ERROR",
                new KhipuEvent[]{new KhipuEvent("form", "2026-09-09T12:00:00Z", "start")},
                "USER_CANCELED"
        );
    }

    @Test
    public void emitsTheEightKeys() throws Exception {
        JSONObject json = KhipuResultMapper.toJson(cancelled());

        assertEquals(8, json.length());
        assertEquals("op-123", json.getString("operationId"));
        assertEquals("ERROR", json.getString("result"));
        assertEquals("", json.getString("exitTitle"));
        assertEquals("", json.getString("exitMessage"));
        assertEquals("", json.getString("exitUrl"));
        assertEquals("USER_CANCELED", json.getString("failureReason"));
    }

    /**
     * The defect this replaces: asJson() is Gson().toJson(this) with serializeNulls off,
     * so a null field produced no key at all and a merchant reading result.continueUrl
     * got undefined on Android and null on iOS. JSONObject.NULL keeps the key present.
     */
    @Test
    public void aNullFieldKeepsItsKeyAndArrivesAsNull() throws Exception {
        JSONObject json = KhipuResultMapper.toJson(cancelled());

        assertTrue("the key must be present", json.has("continueUrl"));
        assertTrue("and it must be JSON null", json.isNull("continueUrl"));
    }

    @Test
    public void mapsEveryEventField() throws Exception {
        JSONObject event = KhipuResultMapper.toJson(cancelled()).getJSONArray("events").getJSONObject(0);

        // The count, not just the three values: scripts/check-option-keys.js anchors on
        // json.put( to find the result keys, which deliberately excludes these three event
        // keys (they land on a fresh JSONObject, not on `json`). Without asserting the
        // count here, a fourth key added to this object on the Java side alone would be
        // caught by neither guard.
        assertEquals(3, event.length());
        assertEquals("form", event.getString("name"));
        assertEquals("start", event.getString("type"));
        assertEquals("2026-09-09T12:00:00Z", event.getString("timestamp"));
    }

    @Test
    public void anEmptyEventListIsAnEmptyArray() throws Exception {
        KhipuResult result = new KhipuResult("op", "", "", null, null, "OK", new KhipuEvent[0], null);

        assertEquals(0, KhipuResultMapper.toJson(result).getJSONArray("events").length());
    }

    @Test
    public void onlyTheErrorResultIsAnError() {
        assertTrue(KhipuResultMapper.isError(cancelled()));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "OK", new KhipuEvent[0], null)));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "WARNING", new KhipuEvent[0], null)));
        assertFalse(KhipuResultMapper.isError(
                new KhipuResult("op", "", "", null, null, "CONTINUE", new KhipuEvent[0], null)));
    }
}
