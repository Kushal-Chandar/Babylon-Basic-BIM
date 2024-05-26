# Babylon Basic BIM

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Babylon.js](https://img.shields.io/badge/Babylon.js-FA5B2A)](https://www.babylonjs.com/)

Welcome to the Babylon Basic BIM project! This repository provides a basic setup to create and interact with 3D models using Babylon.js. Create shapes, extrude them, move them and edit their vertices.

**Play around with it:** <https://babylon-basic-bim.vercel.app/>

![general](media/general.gif)

## Features

### Draw

Add points by clicking on the ground plane and right click to close the shape.
![draw](media/draw.gif)

### Extrude

Click extrude to convert the 2d shape into 3d mesh.
![extrude](media/extrude.gif)

### Move

Click on any mesh to select it and drag it along the ground plane.
![move](media/move.gif)

### Edit

Click on the red spheres and drag it to modify its vertices.
![edit](media/edit.gif)

## Getting Started

To get started with this project, you'll need to have Node.js and npm (or yarn) installed on your machine. If you haven't installed them yet, you can download and install them from Node.js official website.
Installation

Clone the repository and install the dependencies:

```bash
git clone <https://github.com/yourusername/babylon-basic-bim.git>
cd babylon-basic-bim
npm install
```

## Run it

### Start development server

```bash
npm run dev
```

### Build the application

```bash

npm run build
```

### Preview the production build

```bash

npm run preview
```

### Limitations

* Currently the vertex can be pulled into the opposite face of the polygon creating weird shapes.
* Initial setup uses a switch-case style code but switching to a more scene base approach will exponentially improve the code quality.
