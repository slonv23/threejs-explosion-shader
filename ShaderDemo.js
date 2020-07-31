import {GLTFLoader} from "./GltfLoader2.js";
import {OrbitControls} from './OrbitControls.js';

export default class ShaderDemo {

    timestep = 1000 / 60;
    delta = 0;

    constructor() {
        const width = window.innerWidth, height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        window.document.body.appendChild(this.renderer.domElement);

        const light = new THREE.HemisphereLight(0xbbbbff, 0x444422);
        light.position.set(0, 1, 0);
        this.scene.add(light);

        this.gltfLoader = new GLTFLoader();


        // add some objects
        let geometry = new THREE.BoxGeometry( 1, 1, 1 );
        let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let cube = new THREE.Mesh(geometry, material);
        cube.position.z = 0;
        this.scene.add(cube);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    run() {
        //const path = 'assets/SmallSpaceFighter_fragmented.glb';
        //const path = 'assets/StarSparrow.glb'; // 'assets/SmallSpaceFighter2.glb';
        //const path = 'assets/StarSparrow_fragmented.glb';
        const path = 'assets/CubeWithTexture_frag_parts.glb';
        var textureLoader = new THREE.TextureLoader();
        const texture1 = textureLoader.load('assets/lavatile.jpg');
        //debugger;

        this.gltfLoader.load(path, (gltf) => {
            let model = gltf.scene;

            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    texture1: {value: model.children[0].material.map},
                    progress: {value: 0}
                },
                vertexShader:   document.getElementById('sphere-vertex-shader').textContent,
                fragmentShader: document.getElementById('sphere-fragment-shader').textContent
            });
            for (const mesh of gltf.scene.children) {
                mesh.material = mat;

                let verticesCount = mesh.geometry.attributes.position.array.length / 3;
                const centroid = this.getCentroid(mesh.geometry);
                let centroidAttributes = new Array(verticesCount * 3).fill(0);
                for (let i = 0; i < verticesCount * 3; i = i + 3) {
                    centroidAttributes[i] = centroid.x;
                    centroidAttributes[i + 1] = centroid.y;
                    centroidAttributes[i + 2] = centroid.z;
                }

                mesh.geometry.setAttribute('abc', new THREE.BufferAttribute(new Float32Array(centroidAttributes), 3));
                //debugger;
                /*new THREE.ShaderMaterial({
                    uniforms: {
                        texture1: {value: mesh.material.map},
                    },
                    vertexShader:   document.getElementById('sphere-vertex-shader').textContent,
                    fragmentShader: document.getElementById('sphere-fragment-shader').textContent
                });*/
            }

            this.scene.add(model);

            this.startRenderLoop();
        }, undefined, function (err) {
            console.error(err);
        });
    }

    startRenderLoop() {
        requestAnimationFrame((timestamp) => {
            this.lastFrameTimeMs = timestamp;

            // initial drawing
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(this.gameLoop);
        });
    }

    gameLoop = (timestamp) => {
        if (timestamp < this.lastFrameTimeMs + this.timestep) {
            requestAnimationFrame(this.gameLoop);
            return;
        }
        this.delta += timestamp - this.lastFrameTimeMs;
        this.lastFrameTimeMs = timestamp;

        while (this.delta >= this.timestep) {
            // this.update()
            this.delta -= this.timestep;
        }

        this.controls.update();
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(this.gameLoop);
    };

    getCentroid(geometry) {
        let ar = geometry.attributes.position.array;
        let len = ar.length;
        let x = 0,
            y = 0,
            z = 0;
        for (let i = 0; i < len; i = i + 3) {
            x += ar[i];
            y += ar[i + 1];
            z += ar[i + 2];
        }
        return { x: (3 * x) / len, y: (3 * y) / len, z: (3 * z) / len };
    }

}