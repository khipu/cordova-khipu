package com.khipu.cordova;

import com.khipu.client.KhipuOptions;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the options a merchant's JavaScript sent, and applies them to the SDK's builder.
 *
 * The mirror of src/ios/KhipuOptionsMapper.swift, deliberately: the two platforms are
 * called through the same JavaScript, so any divergence between them is a bug the
 * merchant hits and we do not. Keep them in step.
 */
final class KhipuOptionsMapper {

    /**
     * The twelve keys KhipuColors accepts, in the same order as the Swift table. A key
     * that is not here is discarded rather than propagated, so a typo in a merchant's
     * JavaScript does not reach the SDK in silence.
     */
    static final List<String> COLOR_KEYS = Collections.unmodifiableList(Arrays.asList(
            "lightBackground",
            "lightOnBackground",
            "lightPrimary",
            "lightOnPrimary",
            "lightTopBarContainer",
            "lightOnTopBarContainer",
            "darkBackground",
            "darkOnBackground",
            "darkPrimary",
            "darkOnPrimary",
            "darkTopBarContainer",
            "darkOnTopBarContainer"
    ));

    private KhipuOptionsMapper() {
    }

    /**
     * Interprets the dictionary that arrived from JavaScript. It neither throws nor
     * fails: a value of the wrong type is discarded as though it had never been sent.
     */
    static KhipuOptionsInput parse(JSONObject call) {
        KhipuOptionsInput input = new KhipuOptionsInput();
        JSONObject options = objectOrNull(call, "options");

        if (options == null) {
            return input;
        }

        input.topBarTitle = stringOrNull(options, "title");
        input.topBarImageUrl = stringOrNull(options, "titleImageUrl");
        input.skipExitPage = booleanOrNull(options, "skipExitPage");
        input.skipExitSuccessPage = booleanOrNull(options, "skipExitSuccessPage");
        input.showFooter = booleanOrNull(options, "showFooter");
        input.showMerchantLogo = booleanOrNull(options, "showMerchantLogo");
        input.showPaymentDetails = booleanOrNull(options, "showPaymentDetails");
        input.locale = stringOrNull(options, "locale");
        input.theme = themeOrNull(stringOrNull(options, "theme"));

        JSONObject colors = objectOrNull(options, "colors");
        if (colors != null) {
            Map<String, String> valid = new LinkedHashMap<>();
            for (String key : COLOR_KEYS) {
                String value = stringOrNull(colors, key);
                if (value != null) {
                    valid.put(key, value);
                }
            }
            input.colors = valid;
        }

        return input;
    }

    private static KhipuOptions.Theme themeOrNull(String theme) {
        if (theme == null) {
            return null;
        }
        switch (theme) {
            case "light":
                return KhipuOptions.Theme.LIGHT;
            case "dark":
                return KhipuOptions.Theme.DARK;
            case "system":
                return KhipuOptions.Theme.SYSTEM;
            default:
                return null;
        }
    }

    // `opt` plus `instanceof`, not optString/optBoolean. The opt* helpers coerce: on the
    // string "yes", optBoolean returns its false default and that false reaches the SDK,
    // where iOS would have discarded the key. Checking the type makes the two platforms
    // agree by construction instead of by discipline.
    private static String stringOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof String ? (String) value : null;
    }

    private static Boolean booleanOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof Boolean ? (Boolean) value : null;
    }

    private static JSONObject objectOrNull(JSONObject source, String key) {
        Object value = source.opt(key);
        return value instanceof JSONObject ? (JSONObject) value : null;
    }
}
