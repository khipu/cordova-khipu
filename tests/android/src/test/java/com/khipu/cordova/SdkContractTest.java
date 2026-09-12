package com.khipu.cordova;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.khipu.client.KhipuColors;
import com.khipu.client.KhipuOptions;

import org.junit.Test;

import java.util.Arrays;

/**
 * Locks two properties of the pinned SDK that the rest of the suite depends on.
 *
 * The first is that its builders run on a plain JVM. They do today — KhipuOptions.kt
 * imports only java.io.Serializable — and if a future release starts reaching into the
 * Android framework, every mapper test would fail at once with a confusing error. This
 * test fails first, with an obvious one.
 *
 * The second is part of the reason src/android/khipu.gradle says 2.28.5 and not 2.27.0.
 * Protocol 1.0.59 has fourteen FailureReasonType constants and no USER_DISCONNECTED; its
 * forValue() throws IOException on any value it does not know, and the SDK's
 * OPERATION_FAILURE listener calls the converter with no try/catch on socket.io's
 * EventThread, so that throw is uncaught and kills the app process. 1.0.60 has the
 * fifteenth constant. Anyone lowering the pin gets a failing test instead of a crash in
 * a merchant's app. (2.28.5 is the actual floor, on top of this: it synchronises the cookie jar, whose
 * unsynchronised HashSet killed the app process from an OkHttp dispatcher thread. 2.28.4 makes an
 * undecipherable terminal message resolve the merchant's callback instead of stranding
 * the payer with the socket closed and nobody answering.)
 */
public class SdkContractTest {

    @Test
    public void theSdkBuildersRunOnTheJvm() {
        KhipuOptions options = new KhipuOptions.Builder()
                .locale("es_CL")
                .colors(new KhipuColors.Builder().lightPrimary("#8347AD").build())
                .build();

        assertEquals("es_CL", options.getLocale());
        assertNotNull(options.getColors());
    }

    @Test
    public void theProtocolEnumKnowsUserDisconnected() throws Exception {
        // Reflection, not a direct reference: the protocol is a `runtime` scope
        // dependency of the SDK's POM, so it is on the test runtime classpath but not on
        // the compile classpath. Naming it as a compile dependency here would duplicate
        // a version pin that nothing guards.
        Class<?> failureReasonType = Class.forName("com.khipu.khenshin.protocol.FailureReasonType");
        Object[] constants = failureReasonType.getEnumConstants();

        assertNotNull("the protocol jar is not on the test classpath", constants);
        assertEquals(15, constants.length);
        assertTrue(
                "protocol 1.0.59 is on the classpath; the SDK pin must be 2.28.5 or newer",
                Arrays.stream(constants).anyMatch(c -> c.toString().equals("USER_DISCONNECTED"))
        );
    }
}
