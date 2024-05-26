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
  VertexBuffer,
  PointerDragBehavior,
  AbstractMesh,
  Axis,
  FloatArray,
  VertexData,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Button,
  TextBlock,
  Rectangle,
} from "@babylonjs/gui";
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
  private _guiControlButtons: Button[] = [];
  private _vertexLabel;

  private _createUIButton(
    name: string,
    text: string,
    state: string,
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

    console.log(state, this._state);
    if (State[state] == this._state) {
      button.color = null;
      button.background = "white";
    }

    // Modify state on click
    button.onPointerDownObservable.add(() => {
      this._state = State[state];
      for (const guiButton in this._guiControlButtons) {
        let button = this._guiControlButtons[guiButton];
        button.color = guiButton == State[state] ? null : "white";
        button.background = guiButton == State[state] ? "white" : null;
      }
    });

    if (State[state] === State.EXTRUDE) {
      // in case of extrude button when pointer is released change back to draw state
      button.onPointerUpObservable.add(() => {
        this._state = State.DRAW;
        [
          this._guiControlButtons[0].color,
          this._guiControlButtons[0].background,
          this._guiControlButtons[1].color,
          this._guiControlButtons[1].background,
        ] = [
          this._guiControlButtons[1].color,
          this._guiControlButtons[1].background,
          this._guiControlButtons[0].color,
          this._guiControlButtons[0].background,
        ];
      });
    }

    return button;
  }

  private _createCanvas(): HTMLCanvasElement {
    let canvas = document.createElement("canvas");
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
    let position = -25;
    const increment = 50 / 3; // 4 buttons, 3 parts apart, first and last buttons are 50% apart
    Object.keys(State)
      .filter((v) => !isNaN(Number(v)))
      .forEach((key) => {
        const state = State[key];
        const buttonPos = `${position}%`;
        position += increment;
        let button = this._createUIButton(
          state,
          state.charAt(0).toUpperCase() + state.slice(1),
          state,
          buttonPos
        );
        this._guiControlButtons.push(button);
        gui.addControl(button);
      });
    return gui;
  }

  private _createVertexEditLabel() {
    // create Vertex edit label
    let vertexEditLabel = new Rectangle();
    vertexEditLabel.width = 0.2;
    vertexEditLabel.height = "40px";
    vertexEditLabel.color = "white";
    vertexEditLabel.top = "-10%";
    vertexEditLabel.thickness = 1;
    vertexEditLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    let label = new TextBlock("", "To select a shape switch to Move mode");
    vertexEditLabel.addControl(label);
    return vertexEditLabel;
  }

  constructor() {
    // create the this._canvas html element and attach it to the webpage
    this._canvas = this._createCanvas();

    // initialize babylon scene and engine
    this._engine = new Engine(this._canvas, true);
    this._scene = new Scene(this._engine);

    // gui
    this._gui = this._setupGUI();
    this._vertexLabel = this._createVertexEditLabel();

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
      new Vector3(0, 0, 10),
      this._scene
    );
    var light2 = new HemisphericLight(
      "light2",
      new Vector3(10, 0, 0),
      this._scene
    );
    var light3 = new HemisphericLight(
      "light3",
      new Vector3(0, 10, 0),
      this._scene
    );
    light1.intensity = 0.6;
    light2.intensity = 0.6;
    light3.intensity = 0.6;

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
    shapeMaterial.backFaceCulling = false;

    var shape = [[], []]; // index 0 is points, index 1 is lines
    var lastMesh: Mesh = null; // store last mesh drawn to select for extrusion process
    const extrudeDepth = 1;
    function resetShape(shape) {
      [].concat(...shape).forEach((element: Mesh) => {
        element.dispose();
      });
      return [[], []];
    }
    function getVerticesFromFloatArray(vertices): Vector3[] {
      let uniqueVertices = [];
      for (let i = 0; i < vertices.length; i += 3) {
        let vertex = new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
        if (!uniqueVertices.some((v) => v.equals(vertex))) {
          uniqueVertices.push(vertex);
        }
      }
      return uniqueVertices;
    }
    // previous mesh data
    var previouslyPickedMesh: AbstractMesh | null = null;
    const pointerDragBehaviors = [];
    var vertexSpheres = [];
    var prevVertices = [];

    function createPoint(scene, pointPos) {
      const point = MeshBuilder.CreateSphere(
        "point" + pointPos[0],
        { segments: 16, diameter: 0.1 },
        scene
      );
      point.material = pointMaterial;
      point.position = pointPos;
      return point;
    }
    function updateMesh(
      mesh: Mesh,
      delta: Vector3,
      changedVertex?: Vector3 | null
    ) {
      let vertices = mesh.getVerticesData(VertexBuffer.PositionKind);
      for (let i = 0; i < vertices.length; i += 3) {
        if (
          !changedVertex ||
          (changedVertex &&
            vertices[i].toFixed(2) == changedVertex.x.toFixed(2) &&
            vertices[i + 1].toFixed(2) == changedVertex.y.toFixed(2) &&
            vertices[i + 2].toFixed(2) == changedVertex.z.toFixed(2))
        ) {
          vertices[i] += delta.x;
          vertices[i + 1] += delta.y;
          vertices[i + 2] += delta.z;
        }
      }
      let indices = mesh.getIndices();
      let normals = [];
      VertexData.ComputeNormals(vertices, indices, normals);
      let vertexData = new VertexData();
      vertexData.positions = vertices;
      vertexData.indices = indices;
      vertexData.normals = normals;
      vertexData.applyToMesh(mesh, true);
    }
    this._canvas.addEventListener("pointerdown", (evt) => {
      if (this._state !== State.EDIT) {
        vertexSpheres.forEach((elem) => elem.dispose());
        vertexSpheres = [];
      }
      if (previouslyPickedMesh) {
        previouslyPickedMesh.isPickable = true;
        previouslyPickedMesh.enableEdgesRendering();
      }

      ground.isPickable = false;
      switch (this._state) {
        case State.DRAW:
          ground.isPickable = true;
          if (evt.button == 0) {
            // left click
            const pickInfo = this._scene.pick(evt.clientX, evt.clientY);
            if (pickInfo.hit && pickInfo.pickedMesh === ground) {
              const point = createPoint(this._scene, pickInfo.pickedPoint);
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
          if (lastMesh) {
            const polygonVertices = getVerticesFromFloatArray(
              lastMesh.getVerticesData(VertexBuffer.PositionKind)
            );
            var extrude = MeshBuilder.ExtrudePolygon(
              "shape" + polygonVertices[0],
              {
                shape: polygonVertices,
                depth: extrudeDepth,
                updatable: true,
              },
              this._scene,
              earcut
            );
            extrude.material = shapeMaterial;
            updateMesh(extrude, extrude.position.add(new Vector3(0, 1, 0)));
            lastMesh.dispose();
            lastMesh = null;
          }
        case State.MOVE:
          this._gui.removeControl(this._vertexLabel);
          var pickedMesh = this._scene.pick(
            evt.clientX,
            evt.clientY
          ).pickedMesh;
          pointerDragBehaviors.forEach((elem: PointerDragBehavior) => {
            // enable dragging for all meshes
            elem.enabled = true;
          });

          if (pickedMesh && pickedMesh !== previouslyPickedMesh) {
            if (previouslyPickedMesh) {
              previouslyPickedMesh.disableEdgesRendering();
            }
            const pointerDragBehavior = new PointerDragBehavior({
              dragPlaneNormal: Axis.Y,
            });
            pointerDragBehavior.moveAttached = false;
            pointerDragBehavior.onDragObservable.add((event) => {
              var mesh = pointerDragBehavior.attachedNode as Mesh;
              mesh.disableEdgesRendering();
              updateMesh(mesh, event.delta);
              mesh.enableEdgesRendering();
            });
            pointerDragBehavior.useObjectOrientationForDragging = false;
            pickedMesh.addBehavior(pointerDragBehavior);
            pickedMesh.enableEdgesRendering();
            pickedMesh.edgesWidth = 4;
            pickedMesh.position.y += 0.00001;
            pickedMesh.edgesColor = lineMaterial.diffuseColor.toColor4();
            previouslyPickedMesh = pickedMesh;
            pointerDragBehaviors.push(pointerDragBehavior);
          }
          break;
        case State.EDIT:
          this._gui.addControl(this._vertexLabel);
          previouslyPickedMesh.isPickable = false;
          previouslyPickedMesh.disableEdgesRendering();
          pointerDragBehaviors.forEach((elem: PointerDragBehavior) => {
            // disable dragging for all meshes
            elem.enabled = false;
          });

          if (previouslyPickedMesh) {
            prevVertices = getVerticesFromFloatArray(
              previouslyPickedMesh.getVerticesData(VertexBuffer.PositionKind)
            ); // store vertices for new spherers
            if (vertexSpheres.length == 0) {
              prevVertices.forEach((vertex, index) => {
                const point = createPoint(this._scene, vertex);
                var pointerDragBehavior = new PointerDragBehavior();
                pointerDragBehavior.useObjectOrientationForDragging = false;
                pointerDragBehavior.moveAttached = false;
                pointerDragBehavior.onDragObservable.add((event) => {
                  updateMesh(
                    previouslyPickedMesh as Mesh,
                    event.delta,
                    prevVertices[index]
                  );
                  updateMesh(vertexSpheres[index] as Mesh, event.delta);
                  prevVertices[index].addInPlace(event.delta);
                });
                point.addBehavior(pointerDragBehavior);
                vertexSpheres.push(point);
              });
            }
          }
          break;
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
