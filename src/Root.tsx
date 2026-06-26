import React from "react";
import { Composition } from "remotion";
import { DemoComposition } from "./generated/DemoComposition";

// The factory builds one composition — DynamicDemo — from the brief (src/generated).
// `npx remotion render DynamicDemo ...` renders it; the /demo flow handles the rest.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DynamicDemo"
      component={DemoComposition}
      durationInFrames={780}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
