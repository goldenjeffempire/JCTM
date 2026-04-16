import "react";

interface ThreeJSXElement extends Record<string, unknown> {
  ref?: React.Ref<unknown>;
  children?: React.ReactNode;
  key?: React.Key | null;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: ThreeJSXElement;
      pointLight: ThreeJSXElement;
      mesh: ThreeJSXElement;
      sphereGeometry: ThreeJSXElement;
      torusGeometry: ThreeJSXElement;
      meshBasicMaterial: ThreeJSXElement;
      points: ThreeJSXElement;
      bufferGeometry: ThreeJSXElement;
      bufferAttribute: ThreeJSXElement;
      pointsMaterial: ThreeJSXElement;
      cylinderGeometry: ThreeJSXElement;
    }
  }
}
