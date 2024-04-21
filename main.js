import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

const DEFAULT_MASS = 10;

class RigidBody {
    constructor() {
    }

    setRestitution(val) {
        this.body_.setRestitution(val);
    }

    setFriction(val) {
        this.body_.setFriction(val);
    }

    setRollingFriction(val) {
        this.body_.setRollingFriction(val);
    }

    createBox(mass, pos, quat, size) {
        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        this.transform_.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
        this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

        const btSize = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
        this.shape_ = new Ammo.btBoxShape(btSize);
        this.shape_.setMargin(0.10);

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            this.shape_.calculateLocalInertia(mass, this.inertia_);
        }

        this.info_ = new Ammo.btRigidBodyConstructionInfo(
            mass, this.motionState_, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);

        Ammo.destroy(btSize);
    }

    // Function to apply a force to the rigid body
    applyForce(force) {
        if (this.body_) {
            const btForce = new Ammo.btVector3(force.x, force.y, force.z);
            this.body_.applyCentralForce(btForce);
            Ammo.destroy(btForce);
        }
    }

    // Function to apply an impulse to the rigid body
    applyImpulse(impulse) {
        if (this.body_) {
            const btImpulse = new Ammo.btVector3(impulse.x, impulse.y, impulse.z);
            this.body_.applyCentralImpulse(btImpulse);
            Ammo.destroy(btImpulse);
        }
    }

    // Function to set the velocity of the rigid body
    setVelocity(velocity) {
        if (this.body_) {
            const btVelocity = new Ammo.btVector3(velocity.x, velocity.y, velocity.z);
            this.body_.setLinearVelocity(btVelocity);
            Ammo.destroy(btVelocity);
        }
    }
};



class BasicWorldDemo {
    constructor() {
        this._Initialize();
        this._box = null;
    }

    _Initialize() {

        this.rigidBodies_ = [];

        this.collisionConfiguration_ = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher_ = new Ammo.btCollisionDispatcher(this.collisionConfiguration_);
        this.broadphase_ = new Ammo.btDbvtBroadphase();
        this.solver_ = new Ammo.btSequentialImpulseConstraintSolver();
        this.physicsWorld_ = new Ammo.btDiscreteDynamicsWorld(
            this.dispatcher_, this.broadphase_, this.solver_, this.collisionConfiguration_);
        this.physicsWorld_.setGravity(new Ammo.btVector3(0, -100, 0));


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


        const fov = 70;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(130, 50, 50);

        const center = new THREE.Vector3(50, 0, 50);

        this._camera.lookAt(center);

        this._scene = new THREE.Scene();

        const color = 0xFFFFFF;
        const intensity = 1;
        const light = new THREE.AmbientLight(color, intensity);
        this._scene.add(light);

        // const controls = new OrbitControls(
        //     this._camera, this._threejs.domElement);
        // controls.target.set(0, 20, 0);
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

        const boxSize = 5;
        const gridSize = 21; // Adjust the grid size as needed

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(boxSize, boxSize, boxSize * 2), // Each box is 5x5x10
                    new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
                );
                box.position.set(i * boxSize, 0, j * boxSize); // Adjust the positions according to the grid
                //console.log('Setting box position: ', box.position.x, box.position.y, box.position.z);
                //console.log('Setting box quaternion: ', box.quaternion.x, box.quaternion.y, box.quaternion.z, box.quaternion.w);
                box.castShadow = false;
                box.receiveShadow = true;

                this._scene.add(box);

                const rbBox = new RigidBody();
                rbBox.createBox(0, box.position, box.quaternion, new THREE.Vector3(boxSize, boxSize, boxSize * 2));
                const rbPos = rbBox.body_.getCenterOfMassTransform().getOrigin();
                const rbQuat = rbBox.body_.getCenterOfMassTransform().getRotation();
                //console.log('Physics box position: ', rbPos.x(), rbPos.y(), rbPos.z());
                //console.log('Physics box quaternion: ', rbQuat.x(), rbQuat.y(), rbQuat.z(), rbQuat.w());
                rbBox.setRestitution(0.99);
                this.physicsWorld_.addRigidBody(rbBox.body_);
            }
        }

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

            const rbBox = new RigidBody();

            const newQuaternion = new THREE.Quaternion(
                playerData.quaternion.x,
                playerData.quaternion.y,
                playerData.quaternion.z,
                playerData.quaternion.w
            );


            rbBox.createBox(1, this._box.position, newQuaternion, new THREE.Vector3(5, 5, 5));
            rbBox.setRestitution(0.25);
            rbBox.setFriction(1);
            rbBox.setRollingFriction(5);
            this.physicsWorld_.addRigidBody(rbBox.body_);

            this.rigidBodies_.push({ mesh: this._box, rigidBody: rbBox });
            this._box.userData.physicsBody = rbBox;


            this._scene.add(this._box);

            console.log("New player box created");

        });

        socket.emit('create-player');

        //We have gather information about all other boxes and update our scene from server
        socket.on('update-players', (playersData) => {
            console.log(playersData);
            // Iterate over the player data received from the server
            for (const playerId in playersData) {
                const playerData = playersData[playerId];

                // Skip if the player is the current client
                if (playerId === socket.id) continue;

                const existingPlayerBox = this._scene.children.find((child) => {
                    return child instanceof THREE.Mesh && child.userData.socketId === playerId;
                });

                console.log("This is a test:");
                console.log(playerData);
                const newQuaternion = new THREE.Quaternion(
                    playerData.quaternion.x,
                    playerData.quaternion.y,
                    playerData.quaternion.z,
                    playerData.quaternion.w
                );


                if (existingPlayerBox) {
                    // If the player already exists, update its position and color
                    existingPlayerBox.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
                    existingPlayerBox.material.color.setHex(playerData.color);
                    existingPlayerBox.quaternion.copy(newQuaternion);
                } else {
                    // If the player does not exist, create a new box for the player
                    const playerBox = new THREE.Mesh(
                        new THREE.BoxGeometry(5, 5, 5),
                        new THREE.MeshStandardMaterial({ color: playerData.color })
                    );
                    playerBox.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
                    playerBox.quaternion.copy(newQuaternion);
                    playerBox.castShadow = true;
                    playerBox.receiveShadow = true;
                    playerBox.userData.socketId = playerId; // Store socket ID for each box

                    // const rbBox = new RigidBody();
                    // rbBox.createBox(1, playerBox.position, playerBox.quaternion, new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z));
                    // rbBox.setRestitution(0.25);
                    // rbBox.setFriction(1);
                    // rbBox.setRollingFriction(5);
                    // this.physicsWorld_.addRigidBody(rbBox.body_);
                    // this.rigidBodies_.push({ mesh: playerBox, rigidBody: rbBox });

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

        this.updateInterval = setInterval(() => {
            this._SendBoxUpdate(socket);
        }, 1000 / 24);

        // Add event listener to send box updates when key is pressed
        document.addEventListener('keydown', (event) => {
            this._OnKeyDown(event);
            const position = this._box.position.clone();
            const color = this._box.material.color.getHex();
            const quaternionData = this._box.quaternion.clone();

            const quaternion = {
                x: quaternionData.x,
                y: quaternionData.y,
                z: quaternionData.z,
                w: quaternionData.w
            };

            socket.emit('update-box', { position, color, quaternion});
        }, false);

        this.tmpTransform_ = new Ammo.btTransform();
        this.previousRAF_ = null;
        this._RAF();
    }

    _SendBoxUpdate(socket) {
        // Ensure _box is initialized
        if (!this._box) return;

        const position = this._box.position.clone();
        const color = this._box.material.color.getHex();
        const quaternionData = this._box.quaternion.clone();

        const quaternion = {
            x: quaternionData.x,
            y: quaternionData.y,
            z: quaternionData.z,
            w: quaternionData.w,
        };

        socket.emit("update-box", { position, color, quaternion });
    }


    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
        requestAnimationFrame((t) => {
            if (this.previousRAF === null) {
                this.previousRAF_ = t;
            }

            this.step_(t - this.previousRAF_);
            this._threejs.render(this._scene, this._camera);
            this._RAF();
            this.previousRAF_ = t;
        });
    }

    step_(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001;

        this.physicsWorld_.stepSimulation(timeElapsedS, 10);

        for (let i = 0; i < this.rigidBodies_.length; ++i) {
            this.rigidBodies_[i].rigidBody.motionState_.getWorldTransform(this.tmpTransform_);
            const pos = this.tmpTransform_.getOrigin();
            const quat = this.tmpTransform_.getRotation();
            const pos3 = new THREE.Vector3(pos.x(), pos.y(), pos.z());
            const quat3 = new THREE.Quaternion(quat.x(), quat.y(), quat.z(), quat.w());
            this.rigidBodies_[i].mesh.position.copy(pos3);
            this.rigidBodies_[i].mesh.quaternion.copy(quat3);
        }
    }

    _OnKeyDown(event) {
        const speed = 5; // Adjust the speed as needed
        let physicsBody = this._box.userData.physicsBody;
        switch (event.key) {
            case 'd':
                physicsBody.applyImpulse({ x: 0, y: 0, z: -10 });
                break;
            case 'w':
                physicsBody.applyImpulse({ x: -10, y: 0, z: 0 });
                break;
            case 'a':
                physicsBody.applyImpulse({ x: 0, y: 0, z: 10 });
                break;
            case 's':
                physicsBody.applyImpulse({ x: 10, y: 0, z: 0 });
                break;
        }
    }

}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    Ammo().then((lib) => {
        Ammo = lib;
        _APP = new BasicWorldDemo();
    });

});
