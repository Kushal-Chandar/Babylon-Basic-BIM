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
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Button } from "@babylonjs/gui";

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
      this._createUIButton("extrude", "Extrude", State.EXTRUDE, "-10%")
    );
    gui.addControl(this._createUIButton("move", "Move", State.MOVE, "10%"));
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
    var light1 = new HemisphericLight(
      "light1",
      new Vector3(0, 1, 0),
      this._scene
    );
    light1.intensity = 0.7;
    var sphere = MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 1 },
      this._scene
    );
    sphere.position.y = 1;
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 6, height: 6 },
      this._scene
    );

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
