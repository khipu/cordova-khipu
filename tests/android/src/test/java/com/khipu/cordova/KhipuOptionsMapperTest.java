package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.khipu.client.KhipuOptions;

import org.json.JSONObject;
import org.junit.Test;

/**
 * Mirrors tests/ios/KhipuOptionsMapperTests.swift one-to-one, so a case that exists on
 * one platform and is missing on the other is visible at a glance. Keep the names in
 * step with that file.
 */
public class KhipuOptionsMapperTest {

    @Test
    public void withNoOptionsKeyEverythingIsNull() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{\"operationId\":\"abc\"}"));

        assertEquals(new KhipuOptionsInput(), input);
    }

    @Test
    public void mapsEveryScalarField() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{"
                + "\"operationId\":\"abc\","
                + "\"options\":{"
                + "  \"title\":\"Demo\","
                + "  \"titleImageUrl\":\"https://khipu.com/logo.png\","
                + "  \"skipExitPage\":true,"
                + "  \"skipExitSuccessPage\":false,"
                + "  \"showFooter\":false,"
                + "  \"showMerchantLogo\":true,"
                + "  \"showPaymentDetails\":false,"
                + "  \"locale\":\"es_CL\","
                + "  \"theme\":\"dark\""
                + "}}"));

        assertEquals("Demo", input.topBarTitle);
        assertEquals("https://khipu.com/logo.png", input.topBarImageUrl);
        assertEquals(Boolean.TRUE, input.skipExitPage);
        assertEquals(Boolean.FALSE, input.skipExitSuccessPage);
        assertEquals(Boolean.FALSE, input.showFooter);
        assertEquals(Boolean.TRUE, input.showMerchantLogo);
        assertEquals(Boolean.FALSE, input.showPaymentDetails);
        assertEquals("es_CL", input.locale);
        assertEquals(KhipuOptions.Theme.DARK, input.theme);
    }

    /**
     * The plugin has to tell "they did not send me the key" apart from "they sent me
     * false": the SDK applies its own defaults.
     */
    @Test
    public void anAbsentKeyIsNotConfusedWithFalse() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"title\":\"Demo\"}}"));

        assertNull(input.showFooter);
        assertNull(input.skipExitPage);
        assertNull(input.showMerchantLogo);
        assertNull(input.showPaymentDetails);
        assertNull(input.skipExitSuccessPage);
    }

    /**
     * This is the divergence that made Android and iOS disagree. optBoolean("showFooter")
     * on a string returns its false default and passes that to the SDK, while iOS's
     * `as? Bool` discards the key and lets the SDK default apply.
     */
    @Test
    public void aWrongTypeIsDiscardedRatherThanCoerced() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject("{"
                + "\"options\":{"
                + "  \"title\":123,"
                + "  \"showFooter\":\"yes\","
                + "  \"locale\":[\"es\",\"CL\"]"
                + "}}"));

        assertNull(input.topBarTitle);
        assertNull(input.showFooter);
        assertNull(input.locale);
    }

    @Test
    public void anUnknownThemeIsDiscarded() throws Exception {
        assertNull(KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"theme\":\"neon\"}}")).theme);
    }

    @Test
    public void mapsTheTwelveColourKeys() throws Exception {
        JSONObject colors = new JSONObject();
        for (int index = 0; index < KhipuOptionsMapper.COLOR_KEYS.size(); index++) {
            colors.put(KhipuOptionsMapper.COLOR_KEYS.get(index), String.format("#%06X", index));
        }
        JSONObject options = new JSONObject().put("colors", colors);

        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject().put("options", options));

        assertEquals(12, input.colors.size());
        assertEquals("#000002", input.colors.get("lightPrimary"));
    }

    @Test
    public void anUnknownColourKeyIsDiscarded() throws Exception {
        JSONObject colors = new JSONObject().put("lightPrimarry", "#8347AD");
        JSONObject options = new JSONObject().put("colors", colors);

        KhipuOptionsInput input = KhipuOptionsMapper.parse(new JSONObject().put("options", options));

        assertEquals(0, input.colors.size());
    }

    /**
     * The phantom-colors defect: the old code called optionsBuilder.colors(...) outside
     * the `has("colors")` check, so every operation that sent any options injected an
     * empty KhipuColors into the SDK. Absent has to stay absent.
     */
    @Test
    public void anAbsentColorsKeyLeavesColoursNull() throws Exception {
        KhipuOptionsInput input = KhipuOptionsMapper.parse(
                new JSONObject("{\"options\":{\"title\":\"Demo\"}}"));

        assertNull(input.colors);
    }
}
