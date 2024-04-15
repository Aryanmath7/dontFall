import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
class BasicWorldDemo {
    constructor() {
        this._Initialize();
        this._box = null;
    }

    _Initialize() {
        //WEB JS stuff
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
        });
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this._threejs.domElement);

        window.addEventListener('resize', () => {
            this._OnWindowResize();
        }, false);

        const fov = 80;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(75, 40, 0);
        
        const center = new THREE.Vector3(0,10,0);

        this._camera.lookAt(center);

        this._scene = new THREE.Scene();

        const color = 0xFFFFFF;
        const intensity = 1;
        const light = new THREE.AmbientLight(color, intensity);
        this._scene.add(light);

        // const controls = new OrbitControls(
        //     this._camera, this._threejs.domElement);
        // controls.target.set(0, 40, 0);
        // controls.update();

        const loader = new THREE.CubeTextureLoader();
        const texture = loader.load([
            './resources/right.png',
            './resources/left.png',
            './resources/top.png',
            './resources/bottom.png',
            './resources/front.png',
            './resources/back.png',
        ]);
        this._scene.background = texture;

        const plane = new THREE.Mesh(
            new THREE.BoxGeometry(100, 10, 100), // Adjust the second parameter (height) to make the plane thicker
            new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 1,
                side: THREE.DoubleSide,
            })
        );
        plane.castShadow = false;
        plane.receiveShadow = true;
        //plane.rotation.x = -Math.PI / 2;
        //plane.rotation.z = 90;
        plane.rotation.y = -Math.PI / 2;
        this._scene.add(plane);


        this._RAF();

        console.log("we made it here");

        const socket = io('https://78.138.17.29:3000');


        //Create our own box here and send its information to server
        socket.on('player-created', (playerData) => {
            console.log("Player data received: ", playerData);
            const { position, color } = playerData;

            this._box = new THREE.Mesh(
                new THREE.BoxGeometry(5, 5, 5),
                new THREE.MeshStandardMaterial({ color })
            );
            this._box.position.set(position.x, position.y, position.z);
            this._box.castShadow = true;
            this._box.receiveShadow = true;
            //box.userData.socketId = id; // Store socket ID for each box
            this._scene.add(this._box);
            
            console.log("New player box created");
        });

        socket.emit('create-player');


        //We have gather information about all other boxes and update our scene from server

        socket.on('update-players', (playersData) => {
            // Iterate over the player data received from the server
            for (const playerId in playersData) {
                const playerData = playersData[playerId];

                // Skip if the player is the current client
                if (playerId === socket.id) continue;


                const existingPlayerBox = this._scene.children.find((child) => {
                    return child instanceof THREE.Mesh && child.userData.socketId === playerId;
                });

                if (existingPlayerBox) {
                    // If the player already exists, update its position and color
                    existingPlayerBox.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
                    existingPlayerBox.material.color.setHex(playerData.color);
                } else {
                    // If the player does not exist, create a new box for the player
                    const playerBox = new THREE.Mesh(
                        new THREE.BoxGeometry(5, 5, 5),
                        new THREE.MeshStandardMaterial({ color: playerData.color })
                    );
                    playerBox.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
                    playerBox.castShadow = true;
                    playerBox.receiveShadow = true;
                    playerBox.userData.socketId = playerId; // Store socket ID for each box
                    this._scene.add(playerBox);
                    console.log("New player box created for player ID: ", playerId);
                }
            }

            // Remove boxes for players that are no longer present
            this._scene.children.forEach((child) => {
                if (child instanceof THREE.Mesh && child.userData.socketId && !playersData[child.userData.socketId]) {
                    this._scene.remove(child);
                    console.log("Player box removed for player ID: ", child.userData.socketId);
                }
            });
        });


        // Add event listener to send box updates when key is pressed
        document.addEventListener('keydown', (event) => {
            this._OnKeyDown(event);
            const position = this._box.position.clone();
            const color = this._box.material.color.getHex();
            socket.emit('update-box', { position, color });
        }, false);
    }

    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
        requestAnimationFrame(() => {
            this._threejs.render(this._scene, this._camera);
            this._RAF();
        });
    }

    _GenerateRandomColor() {
        return Math.random() * 0xFFFFFF;
    }

    _OnKeyDown(event) {
        const speed = 1; // Adjust the speed as needed
        switch (event.key) {
            case 'w':
                this._box.position.z -= speed;
                break;
            case 'a':
                this._box.position.x -= speed;
                break;
            case 's':
                this._box.position.z += speed;
                break;
            case 'd':
                this._box.position.x += speed;
                break;
        }
    }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new BasicWorldDemo();
});
