import { Config } from "@remotion/cli/config";

// Software ANGLE — reliable WebGL in headless Chromium on macOS arm64.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(4);
