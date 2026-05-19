const { contextBridge } = require("electron");

function readArgument(prefix) {
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

contextBridge.exposeInMainWorld(
  "speechyDesktop",
  Object.freeze({
    isDesktop: true,
    ttsApiBaseUrl: readArgument("--speechy-tts-api-base-url="),
  }),
);
