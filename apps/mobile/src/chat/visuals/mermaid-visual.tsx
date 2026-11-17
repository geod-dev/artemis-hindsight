import { useMemo, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { usePreferences } from "@/preferences";
import { VisualCard, VisualError, VisualSkeleton } from "./shared";

// Mermaid is drawn by the same library as on the web app, loaded from a CDN inside a WebView (it is large).
const MERMAID_SCRIPT = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js";

/** The page that renders one diagram. The source travels as a JSON string, so it cannot break out of the script. */
function diagramHtml(source: string, dark: boolean, textColor: string): string {
  const safeSource = JSON.stringify(source).replace(/</g, "\\u003c");
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: transparent; color: ${textColor}; font-family: sans-serif; }
  #out { display: flex; justify-content: center; }
  #out svg { max-width: 100%; height: auto; }
</style>
<script src="${MERMAID_SCRIPT}"></script>
</head><body><div id="out"></div><script>
  function post(payload) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: ${dark ? '"dark"' : '"default"'} });
  mermaid.render("diagram" + Date.now(), ${safeSource})
    .then(function (result) {
      document.getElementById("out").innerHTML = result.svg;
      post({ height: document.body.scrollHeight });
    })
    .catch(function (error) { post({ error: String(error && error.message ? error.message : error) }); });
</script></body></html>`;
}

/** A Mermaid diagram (the agent's `mermaid` and `visual__diagram` blocks), drawn in a WebView sized to its content. */
export function MermaidVisual({ code, closed }: { code: string; closed: boolean }) {
  const { colors, isDark } = usePreferences();
  const [height, setHeight] = useState(160);
  const [failure, setFailure] = useState<string | null>(null);

  const html = useMemo(() => diagramHtml(code, isDark, colors.text), [code, isDark, colors.text]);

  if (!closed) return <VisualSkeleton label="Loading diagram" height={height} />;
  if (failure) return <VisualError title="Invalid diagram" message={failure} />;

  const onMessage = (event: WebViewMessageEvent) => {
    const payload = JSON.parse(event.nativeEvent.data) as { height?: number; error?: string };
    if (payload.error) setFailure(payload.error);
    else if (payload.height) setHeight(Math.min(Math.max(payload.height, 80), 640));
  };

  return (
    <VisualCard>
      <View style={{ height }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          onMessage={onMessage}
          scrollEnabled={false}
          javaScriptEnabled
          style={{ backgroundColor: "transparent" }}
          containerStyle={{ backgroundColor: "transparent" }}
        />
      </View>
    </VisualCard>
  );
}
