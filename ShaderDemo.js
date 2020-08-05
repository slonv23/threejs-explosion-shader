import {GLTFLoader} from "./GltfLoader2.js";
import {OrbitControls} from './OrbitControls.js';
import {ParticleEngine, Tween, Type} from "./ParticleEngine.js";

const textureLoader = new THREE.TextureLoader();

const particleEngineParameters = {
    positionStyle  : Type.SPHERE,
    positionBase   : new THREE.Vector3( 0, 0, 0 ),
    positionRadius : 2,

    velocityStyle : Type.SPHERE,
    speedBase     : 40, //40,
    speedSpread   : 8,

    particleTexture : textureLoader.load('assets/smokeparticle.png'), //THREE.ImageUtils.loadTexture( 'assets/smokeparticle.png' ),

    sizeTween    : new Tween( [0, 0.1], [1, 150] ),
    opacityTween : new Tween( [0.7, 1], [1, 0] ),
    colorBase    : new THREE.Vector3(0.02, 1, 0.4),
    blendStyle   : THREE.AdditiveBlending,

    particlesPerSecond : 360,
    particleDeathAge   : 3, //1.5,
    emitterDeathAge    : 1, //60
};

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
        /*let geometry = new THREE.BoxGeometry( 1, 1, 1 );
        let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let cube = new THREE.Mesh(geometry, material);
        cube.position.z = 0;
        this.scene.add(cube);*/

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        //this.particleEngine = new ParticleEngine();
        //this.particleEngine.setValues(particleEngineParameters);
        //this.particleEngine.initialize(this.scene);

        var geometry = new THREE.SphereGeometry(0.1, 16, 16);
        geometry.applyMatrix( new THREE.Matrix4().makeScale( 1.0, 1.2, 3.0/*1.5*/ ));
        //let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let material = new THREE.ShaderMaterial({
            vertexShader:   document.getElementById('plasma-blast-vertex-shader').textContent,
            fragmentShader: document.getElementById('plasma-blast-fragment-shader').textContent,
            transparent: true,

        });
        let ellipsoid  = new THREE.Mesh(geometry, material);
        let ellipsoid2  = new THREE.Mesh(geometry, material);
        let ellipsoid3  = new THREE.Mesh(geometry, material);
        ellipsoid2.position.z -= 1;
        ellipsoid3.position.y -= 1;
        this.scene.add(ellipsoid);
        this.scene.add(ellipsoid2);
        this.scene.add(ellipsoid3);

    }

    run() {
        //const path = 'assets/SmallSpaceFighter_fragmented.glb';
        //const path = 'assets/StarSparrow.glb'; // 'assets/SmallSpaceFighter2.glb';
        //const path = 'assets/StarSparrow_fragmented.glb';
        const path = 'assets/CubeWithTexture_frag_parts.glb';
        //const textureLoader = new THREE.TextureLoader();
        //const texture1 = textureLoader.load('assets/lavatile.jpg');
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
            this.mat = mat;
            for (const mesh of gltf.scene.children) {
                mesh.material = mat;

                let verticesCount = mesh.geometry.attributes.position.array.length / 3;
                //const centroid = this.getCentroid(mesh.geometry);
                const centroid = mesh.position; //this.getCentroid(mesh.geometry);
                const rotationSpeed = Math.random() * 0.03 + 0.03; //0.006;
                const rotationAxis = this.randomUnitVector();

                const centroidAttributes = new Array(verticesCount * 3).fill(0);
                const rotationAxisAttributes = new Array(verticesCount * 3).fill(0);
                const rotationSpeedAttributes = new Array(verticesCount).fill(0);

                for (let i = 0, j = 0; i < verticesCount * 3; i = i + 3, j = j + 1) {
                    centroidAttributes[i] = centroid.x;
                    centroidAttributes[i + 1] = centroid.y;
                    centroidAttributes[i + 2] = centroid.z;
                    rotationAxisAttributes[i] = rotationAxis.x;
                    rotationAxisAttributes[i + 1] = rotationAxis.y;
                    rotationAxisAttributes[i + 2] = rotationAxis.z;
                    rotationSpeedAttributes[j] = rotationSpeed;
                }

                //const quat = [0, 0, 0, 1];
                //const quatMultiplier = [this.timestep * 0.5 * angularVelocity, 0, 0, 1];
                //debugger;

                mesh.geometry.setAttribute('abc', new THREE.BufferAttribute(new Float32Array(centroidAttributes), 3));
                mesh.geometry.setAttribute('rtAxis', new THREE.BufferAttribute(new Float32Array(rotationAxisAttributes), 3));
                mesh.geometry.setAttribute('rtSpeed', new THREE.BufferAttribute(new Float32Array(rotationSpeedAttributes), 1));
                // rotationAxis.x, rotationAxis.y, rotationAxis.z
                //mesh.geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(new Float32Array([rotationSpeed]), 1));
                /*
                    attribute vec4 quat;
                    attribute vec4 quatMultiplier;
                 */


                // angleChange.y * 0.5,

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

    randomUnitVector() {
        const vect = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        vect.normalize();
        return vect;
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
            //this.particleEngine.update(this.timestep);
            this.mat.uniforms.progress.value += this.delta;
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
