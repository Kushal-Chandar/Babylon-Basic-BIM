import "./style.css";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  Color3,
  StandardMaterial,
  Mesh,
  EdgesRenderer,
  VertexData,
  VertexBuffer,
  ExtrudeShape,
  PointerDragBehavior,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Button } from "@babylonjs/gui";
import earcut from "earcut";

enum State {
  DRAW = 0,
  EXTRUDE = 1,
  MOVE = 2,
  EDIT = 3,
}

class App {
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _engine: Engine;

  private _state: State = State.DRAW;
  private _gui: AdvancedDynamicTexture;

  private _createUIButton(
    name: string,
    text: string,
    state: State,
    xPos: string
  ) {
    const button = Button.CreateSimpleButton(name, text);
    button.width = 0.1;
    button.height = "40px";
    button.color = "white";
    button.top = "10%";
    button.left = xPos;
    button.thickness = 1;
    button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    button.cornerRadius = 25;

    // Modify state on click
    button.onPointerDownObservable.add(() => {
      this._state = state;
    });

    return button;
  }

  private _createCanvas(): HTMLCanvasElement {
    var canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.maxHeight = "100vh";
    canvas.style.justifyContent = "center";
    canvas.style.display = "flex";
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
    return canvas;
  }

  private _setupGUI() {
    const gui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    gui.addControl(this._createUIButton("draw", "Draw", State.DRAW, "-25%"));
    gui.addControl(
      this._createUIButton("extrude", "Extrude", State.EXTRUDE, "-8.3%")
    );
    gui.addControl(this._createUIButton("move", "Move", State.MOVE, "8.3%"));
    gui.addControl(this._createUIButton("edit", "Edit", State.EDIT, "25%"));
    return gui;
  }

  constructor() {
    // create the this._canvas html element and attach it to the webpage
    this._canvas = this._createCanvas();

    // initialize babylon scene and engine
    this._engine = new Engine(this._canvas, true);
    this._scene = new Scene(this._engine);

    // gui
    this._gui = this._setupGUI();

    // camera
    var camera = new ArcRotateCamera(
      "Camera",
      Math.PI / 2,
      -Math.PI / 2,
      2,
      new Vector3(0, 5, -10),
      this._scene
    );
    camera.setTarget(Vector3.Zero());
    camera.attachControl(this._canvas, true, true);

    // light
    var light1 = new HemisphericLight(
      "light1",
      new Vector3(0, 0, 2),
      this._scene
    );
    var light2 = new HemisphericLight(
      "light2",
      new Vector3(2, 0, 0),
      this._scene
    );
    var light3 = new HemisphericLight(
      "light3",
      new Vector3(0, 2, 0),
      this._scene
    );
    light1.intensity = 0.7;
    light2.intensity = 0.7;
    light3.intensity = 0.7;

    // ground
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 6, height: 6 },
      this._scene
    );

    // Create meterials
    const pointMaterial = new StandardMaterial("pointMaterial", this._scene);
    pointMaterial.diffuseColor = new Color3(1, 0, 0); // Red color
    const lineMaterial = new StandardMaterial("lineMaterial", this._scene);
    lineMaterial.diffuseColor = new Color3(0, 0, 1); // Blue color
    const shapeMaterial = new StandardMaterial("shapeMaterial", this._scene);
    shapeMaterial.diffuseColor = new Color3(0, 1, 0); // Green color

    var shape = [[], []]; // index 0 is points, index 1 is lines
    var lastMesh: Mesh = null; // store last mesh drawn to select for extrusion process
    const extrudeDepth = 1;
    function resetShape(shape) {
      [].concat(...shape).forEach((element: Mesh) => {
        element.dispose();
      });
      return [[], []];
    }
    function getVerticesFromFloatArray(vertices) {
      var uniqueVertices = [];
      for (var i = 0; i < vertices.length; i += 3) {
        var vertex = new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
        if (!uniqueVertices.some((v) => v.equals(vertex))) {
          uniqueVertices.push(vertex);
        }
      }
      return uniqueVertices;
    }
    var pickedMoveMesh = null;

    this._canvas.addEventListener("pointerdown", (evt) => {
      switch (this._state) {
        case State.DRAW:
          ground.isPickable = true;
          if (evt.button == 0) {
            // left click
            const pickInfo = this._scene.pick(evt.clientX, evt.clientY);
            if (pickInfo.hit && pickInfo.pickedMesh === ground) {
              const point = MeshBuilder.CreateSphere(
                "point",
                { segments: 16, diameter: 0.1 },
                this._scene
              );
              point.material = pointMaterial;
              point.position = pickInfo.pickedPoint;

              shape[0].push(point);
              if (shape[0].length > 1) {
                const prevPoint: Mesh = shape[0][shape[0].length - 2];
                const line = MeshBuilder.CreateLines(
                  "line" + prevPoint.position + point.position,
                  { points: [prevPoint.position, point.position] },
                  this._scene
                );
                line.material = lineMaterial;
                shape[1].push(line);
              }
            }
          }
          if (evt.button == 2) {
            if (shape[0].length > 2) {
              const points = shape[0].map((point: Mesh) => point.position);
              [].concat(...shape).forEach((element: Mesh) => {
                element.dispose();
              });
              var polygon = MeshBuilder.CreatePolygon(
                "shape" + points[0],
                {
                  shape: points,
                  updatable: true,
                  depth: 0,
                  sideOrientation: Mesh.DOUBLESIDE,
                },
                this._scene,
                earcut
              );
              polygon.enableEdgesRendering();
              polygon.edgesWidth = 4;
              polygon.edgesColor = lineMaterial.diffuseColor.toColor4();
              polygon.position.y += 0.00001; // lift slighly off the ground
              lastMesh = polygon;
              shape = resetShape(shape);
            }
          }
          break;
        case State.EXTRUDE:
          shape = resetShape(shape); // remove incomplete shape
          const polygonVertices = getVerticesFromFloatArray(
            lastMesh.getVerticesData(VertexBuffer.PositionKind)
          );
          var extrude = MeshBuilder.ExtrudePolygon(
            "shape" + polygonVertices[0],
            {
              shape: polygonVertices,
              depth: extrudeDepth,
              updatable: true,
              sideOrientation: Mesh.DOUBLESIDE,
            },
            this._scene,
            earcut
          );
          extrude.material = shapeMaterial;
          extrude.position.y += extrudeDepth;
          lastMesh.dispose();
          this._state = State.DRAW; // Change back to draw
          break;
        case State.MOVE:
          ground.isPickable = false;
          this._scene.getActiveMeshes().forEach((element) => {
            element;
          });
          var pickedMesh = this._scene.pick(
            evt.clientX,
            evt.clientY
          ).pickedMesh;
          if (pickedMesh && pickedMoveMesh) {
            pickedMoveMesh.disableEdgesRendering();
          }
          var pointerDragBehavior = new PointerDragBehavior({
            dragPlaneNormal: new Vector3(0, 1, 0),
          });
          pointerDragBehavior.useObjectOrientationForDragging = false;
          pickedMesh.addBehavior(pointerDragBehavior);
          pickedMesh.enableEdgesRendering();
          pickedMesh.edgesWidth = 4;
          pickedMesh.position.y += 0.00001;
          pickedMesh.edgesColor = lineMaterial.diffuseColor.toColor4();
          pickedMoveMesh = pickedMesh;
        default:
          break;
      }
    });

    // hide/show the Inspector
    window.addEventListener("keydown", (ev) => {
      // Shift+Ctrl+Alt+I
      if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.code === "KeyI") {
        if (this._scene.debugLayer.isVisible()) {
          this._scene.debugLayer.hide();
        } else {
          this._scene.debugLayer.show();
        }
      }
    });

    window.addEventListener("resize", () => {
      this._engine.resize();
    });

    // run the main render loop
    this._engine.runRenderLoop(() => {
      this._scene.render();
    });
  }
}
new App();
