'use strict';

const defaultConfig = {
    /**
     * Scene configs
     */
    bgColor: 0x424242,
    fogFactor: 0.5,
    renderDistance: 100,
    ambientColor: 0xffffff,
    ambientIntensity: 0.5,
    lightColor: 0xffffff,
    lightIntensity: 0.5,

    /**
     * Camera configs
     */
    cameraPosition: [3,3,3],
    cameraLookAt: [0,0,0],
    cameraFOV: 70,
    cameraSmooth: 5,
    zoomFactor: 0.001,
    rotateFactor: 0.01,
    moveFactor: 0.01,
    autoRotate: 0,
    showGroundPlane: true,

    /**
     * FPS Counter
     */
    fpsInterval: 60,
}


class CameraController {
    constructor( config ) {
        this.camera = new THREE.PerspectiveCamera(
            config.cameraFOV, 1, config.near, config.renderDistance
        );
        this.camera.up = new THREE.Vector3(0,0,1);

        this._newPosition = (new THREE.Vector3()).fromArray(config.cameraPosition);
        this._newLookAt = (new THREE.Vector3()).fromArray(config.cameraLookAt);
        this._lookAt = this._newLookAt.clone();
        this._alpha = config.cameraSmooth;

        this.smooth = config.cameraSmooth;
        this.autoRotate = config.autoRotate;
    }

    update() {
        if (this.autoRotate != 0) {
            const autoRotate = this.autoRotate*3.1415927/180/60
            this.rotateHorizontal(autoRotate, true);
        }

        if (this._alpha >= this.smooth) {
            this.camera.position.copy(this._newPosition);
            this._oldPosition = this.position;
            this._oldLookAt = this.lookAt;
        } else {
            this._alpha += 1;
            this.camera.position.lerpVectors(
                this._oldPosition, this._newPosition,
                this._alpha / this.smooth
            );
            this._lookAt.lerpVectors(
                this._oldLookAt, this._newLookAt, 
                this._alpha / this.smooth
            );
        }
        this.camera.lookAt(this._lookAt);
    }

    get position() {
        return this.camera.position.clone();
    }

    set position(position) {
        this.setPosition(position, true);
    }

    setPosition(position, smooth=true) {
        if (smooth) {
            this._alpha = 0;
            this._oldPosition.copy(this.camera.position);
            this._newPosition.copy(position);
        } else {
            this._alpha = this.smooth;
            this.camera.position.copy(position);
            this._oldPosition.copy(position);
            this._newPosition.copy(position);
        }
    }

    get lookAt() {
        return this._lookAt.clone();
    }

    set lookAt(lookAt) {
        this.setLookAt(lookAt, true);
    }

    setLookAt(lookAt, smooth=true) {
        if (smooth) {
            this._alpha = 0;
            this._oldLookAt.copy(this._lookAt);
            this._newLookAt.copy(lookAt);
        } else {
            this._alpha = this.smooth;
            this._lookAt.copy(lookAt);
            this._oldLookAt.copy(lookAt);
            this._newLookAt.copy(lookAt);
        }
    }

    get relativePosition() {
        const relativePosition = new THREE.Vector3();
        return relativePosition.subVectors( this._newPosition, this._newLookAt );
    }

    get currentRelativePosition() {
        const relativePosition = new THREE.Vector3();
        return relativePosition.subVectors( this.position, this.lookAt );
    }

    get zoom() {
        return this.relativePosition.length();
    }

    set zoom(zoom) {
        zoom = Math.max(zoom , 0.1);
        const relativePosition = this.relativePosition.normalize().multiplyScalar(zoom);
        this.position = this._newPosition.clone().addVectors( this.lookAt, relativePosition );
    }

    rotateHorizontal(rot, smooth=false) {
        const axis = new THREE.Vector3(0,0,1);
        const relativePosition = this.relativePosition.applyAxisAngle( axis, rot );
        this.setPosition(relativePosition.addVectors( this.lookAt, relativePosition ), smooth);
    }

    rotateVertical(rot, smooth=false) {
        const relativePosition = this.relativePosition;
        const axis = (new THREE.Vector3(-relativePosition.y, relativePosition.x, 0)).normalize();
        relativePosition.applyAxisAngle( axis, rot );
        this.setPosition(relativePosition.addVectors( this.lookAt, relativePosition ), smooth);
    }

    moveHorizontal(distance, smooth=false) {
        const relativePosition = this.relativePosition;
        const movement = (new THREE.Vector3(-relativePosition.y, relativePosition.x, 0)).normalize().multiplyScalar(distance);
        this.setPosition(this.position.add(movement), smooth);
        this.setLookAt(this.lookAt.add(movement), smooth);
    }

    moveVertical(distance, smooth=false) {
        const movement = (new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(distance);
        this.setPosition(this.position.add(movement), smooth);
        this.setLookAt(this.lookAt.add(movement), smooth);
    }
}

class FPSCounter {
    constructor(interval=60) {
        this.fps = 0;
        this.interval = interval;
        this._start = Date.now();
        this._i = 0;
    }

    update() {
        if (this._i > this.interval) {
            this._i = 0;
            this.fps = 1000 / (Date.now() - this._start) * this.interval;
            this._start = Date.now();
        } else {
            this._i += 1;
        }
    }
}



class Vis3D {
    constructor( config=defaultConfig ) {
        config = { ...defaultConfig, ...config }
        this.config = config

        this.cameraController = new CameraController(config);

        /**
         * Renderer
         */
        this.renderer = new THREE.WebGLRenderer(config);
        this.renderer.domElement.addEventListener('wheel', e => {
            e.preventDefault();
            this.cameraController.zoom = this.cameraController.zoom * (1 + config.zoomFactor * e.deltaY);
        });
        this.renderer.domElement.addEventListener('mousemove', e => {
            e.preventDefault()
            if (e.buttons == 4 && !e.shiftKey) {
                // Middle click rotates camera
                this.cameraController.rotateHorizontal(-e.movementX * config.rotateFactor);
                this.cameraController.rotateVertical(-e.movementY * config.rotateFactor);
            } else if (e.buttons == 4 && e.shiftKey) {
                // Shift + middle click moves camera
                this.cameraController.moveHorizontal(-e.movementX * config.moveFactor);
                this.cameraController.moveVertical(e.movementY * config.moveFactor);
            }
        });

        /**
         * Scene
         */
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(config.bgColor);
        this.scene.fog = new THREE.Fog(
            new THREE.Color(config.bgColor),
            config.renderDistance*config.fogFactor, 
            config.renderDistance 
        );

        this.ambientLight = new THREE.AmbientLight( 
            config.ambientColor, config.ambientIntensity 
        );
        this.directionalLight = new THREE.DirectionalLight(
            config.lightColor, config.lightIntensity
        );
        this.scene.add(this.ambientLight);
        this.scene.add(this.directionalLight);

        this.groundPlane = {
            type: 'GroundPlane',
            name: 'Ground plane',
            uuid: uuidv4()
        };
        this.defaultCube = {
            type: 'DefaultCube',
            name: 'Default cube',
            uuid: uuidv4()
        }
        this.objects = {}
        this.add(this.groundPlane);
        this.add(this.defaultCube);

        this.fpsCounter = new FPSCounter(config.fpsInterval);

        /**
         * Connect to server
         */
    }

    getColor(data) {
        let c;
        if (data instanceof Array) {
            if (data.length < 3) {
                console.error('Invalid color: ' + data);
                c = new THREE.Color();
            } else {
                c = new THREE.Color(data[0], data[1], data[2]);
            }
        } else {
            c = new THREE.Color(data);
        }
        return c;
    }

    makeGroundPlane(size=200) {
        const geometry = new THREE.PlaneGeometry(size, size, size, size);
        const wireframe = new THREE.WireframeGeometry( geometry );
        const position = wireframe.getAttribute('position').array;
        const newPosition = new Float32Array(position.length-size*size*6);
        for (let i = 0, j = 0; i < position.length; i += 6) {
            if (position[i] == position[i+3] || position[i+1] == position[i+4]) {
                newPosition.set(position.slice(i, i+6), j);
                j += 6;
            }
        }
        wireframe.setAttribute(
            'position', new THREE.BufferAttribute(newPosition, 3)
        );
        const line = new THREE.LineSegments( wireframe );
        line.material.ztest = false;
        line.material.opacity = 0.1;
        line.material.transparent = true;
        return line;
    }

    makeDefaultCube(size=2) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial();
        return new THREE.Mesh( geometry, material );
    }

    makePointCloud(data) {
        const points = new Float32Array(data.points.flat());
        const color = new Float32Array(points.length * 3)
        if (data.color instanceof Array) {
            for (let i = 0; i < points.length; ++i) {
                const c = this.getColor(data.color[i]);
                color.set([ c.r, c.g, c.b ], 3*i);
            }
        } else {
            const c = this.getColor(data.color);
            for (let i = 0; i < points.length; ++i) {
                color.set([ c.r, c.g, c.b ], 3*i);
            }
        }


        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));

        const material = new THREE.PointsMaterial({
            // color: new THREE.Color(data.color),
            vertexColors: true,
            size: data.size
        });
        return new THREE.Points(geometry, material);
    }

    makeBBox7(data) {
        /**
         * (x, y, z, xs, ys, zs, rot_z)
         */
        const bbox = data.bbox;
        const geometry = new THREE.BufferGeometry();
        const x = bbox[0], y = bbox[1], z = bbox[2],
              xs2 = bbox[3]/2, ys2 = bbox[4]/2, zs2 = bbox[5]/2, rot = data[6];
        const xmin = x - xs2, xmax = x + xs2,
              ymin = y - ys2, ymax = y + ys2,
              zmin = z - zs2, zmax = z + zs2;
        const vertices = new Float32Array([
            xmin, ymin, zmin, xmax, ymin, zmin,
            xmax, ymin, zmin, xmax, ymax, zmin,
            xmax, ymax, zmin, xmin, ymax, zmin,
            xmin, ymax, zmin, xmin, ymin, zmin,
            xmin, ymin, zmax, xmax, ymin, zmax,
            xmax, ymin, zmax, xmax, ymax, zmax,
            xmax, ymax, zmax, xmin, ymax, zmax,
            xmin, ymax, zmax, xmin, ymin, zmax,
            xmin, ymin, zmin, xmin, ymin, zmax,
            xmax, ymin, zmin, xmax, ymin, zmax,
            xmax, ymax, zmin, xmax, ymax, zmax,
            xmin, ymax, zmin, xmin, ymax, zmax
        ]);
        geometry.setAttribute('position', vertices);
        geometry.rotateZ(rot);
        let material;
        if (data.dashed) {
            material = new LineDashedMaterial({
                color: this.getColor(data.color),
                linewidth: data.linewidth,
                scale: data.scale,
                dashSize: data.dashsize,
                gapSize: data.gapsize
            })
        } else {
            material = new LineBasicMaterial({
                color: this.getColor(data.color),
                linewidth: data.linewidth
            })
        }
        return new LineSegments(geometry, material);
    }

    makeObject(obj) {
        switch (obj.type) {
            case 'GroundPlane':
                obj.obj = this.makeGroundPlane(this.config.renderDistance*4);
                break;
            case 'DefaultCube':
                obj.obj = this.makeDefaultCube();
                break;
            case 'PointCloud':
                obj.obj = this.makePointCloud(obj.data);
                break;
            case 'BBox7':
                obj.obj = this.makeBBox7(obj.data);
                break;
            default:
                throw 'Unknown object type: ' + obj.type;
        }
    }

    set(objs) {
        for (const uuid in this.objects) {
            if (uuid != this.groundPlane.uuid) {
                const obj = this.objects[uuid].obj;
                this.scene.remove(obj);
            }
        }
        this.objects = {};
        this.objects[this.groundPlane.uuid] = this.groundPlane;
        for (const uuid in objs)
            this.add(objs[uuid]);
    }

    add(obj) {
        obj.show = true;
        if (obj.uuid in this.objects)
            this.scene.remove(this.objects[obj.uuid].obj);
        this.makeObject(obj);
        this.objects[obj.uuid] = obj;
        this.scene.add(obj.obj);
    }

    remove(uuid) {
        if (uuid in this.objects) {
            this.scene.remove(this.objects[uuid].obj);
            delete this.objects[uuid];
        }
    }

    show(uuid) {
        if (uuid in this.objects) {
            this.objects[uuid].show = true;
            this.scene.add(this.objects[uuid].obj);
        }
    }

    showAll() {
        const showGround = this.groundPlane.show;
        for (const uuid in this.objects) {
            if (uuid != this.groundPlane.uuid || showGround)
                this.show(uuid);
        }
    }

    showOnly(uuid) {
        if (uuid in this.objects) {
            const showGround = this.groundPlane.show;
            for (const i in this.objects) {
                if (i != uuid && this.objects[i].show && 
                    (i != this.groundPlane.uuid || !showGround))
                    this.hide(i);
            }
            this.show(uuid);
        }
    }

    hide(uuid) {
        if (uuid in this.objects) {
            this.objects[uuid].show = false;
            this.scene.remove(this.objects[uuid].obj);
        }
    }

    hideAll() {
        const showGround = this.groundPlane.show;
        for (const uuid in this.objects) {
            if (uuid != this.groundPlane.uuid || !showGround)
                this.hide(uuid);
        }
    }

    updateDirectionalLight() {
        const relativePosition = this.cameraController.currentRelativePosition;
        this.directionalLight.position.copy(new THREE.Vector3(-relativePosition.y, relativePosition.x, 0));
        this.directionalLight.position.negate().add(this.cameraController.position);
        this.directionalLight.lookAt(this.cameraController.lookAt);
    }

    render() {
        requestAnimationFrame( () => this.render() );
        this.cameraController.update();
        this.updateDirectionalLight();
        this.renderer.render(this.scene, this.cameraController.camera);
        this.fpsCounter.update();
    }
}

class Vis3DClient extends EventTarget {
    constructor(vis3d, host=undefined, port=undefined) {
        super();
        this.vis3d = vis3d;
        this.host = host;
        this.port = port;
        if (this.host !== undefined && this.port !== undefined)
            this.connect();
    }

    connect() {
        if (this.ws !== undefined)
            this.ws.close();
        this.ws = new WebSocket('ws://' + this.host + ':' + this.port);
        this.ws.onopen = (e) => this.sync();
        this.ws.onerror = (e) => console.error(e);
        this.ws.addEventListener('message', (res) => {
            this.dispatchEvent(new Event('message'));
            let msg;
            try {
                msg = JSON.parse(res.data);
            } catch (e) {
                throw 'Invalid response: ' + res.data
            }
            switch (msg.type) {
                case 'sync':
                    this.vis3d.set(msg.data);
                    break;
                case 'add':
                    this.vis3d.add(msg.data);
                    break;
                case 'remove':
                    this.vis3d.remove(msg.data);
                    break;
                case 'show':
                    this.vis3d.show(msg.data);
                    break;
                case 'hide':
                    this.vis3d.hide(msg.data);
                    break;
                defualt:
                    throw 'Unknown message: ' + data;
            }
            this.dispatchEvent(new Event('change'));
        });
        this.dispatchEvent(new Event('connect'));
    }

    sync() {
        if (this.ws === undefined || this.ws.readyState !== 1)
            throw 'Client is not connected to a server!';
        this.ws.send(JSON.stringify({type: 'sync'}))
    }

}

(function () {
    const canvas = document.getElementById('vis3d');
    const vis3d = new Vis3D({
        canvas: canvas,
        antialias: true
    });
    const vis3dClient = new Vis3DClient(vis3d, 'localhost', 1008);
    vis3d.render();
    window.vis3d = vis3d;
    window.vis3dClient = vis3dClient;

    const windowResize = e => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        vis3d.renderer.setSize( canvas.width, canvas.height );
        vis3d.cameraController.camera.aspect = canvas.width / canvas.height;
        vis3d.cameraController.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', windowResize);
    windowResize();

    setInterval(() => {
        document.getElementById('fps').innerText = vis3d.fpsCounter.fps.toFixed(0);
    }, 1000);


    function updateControl() {
        requestAnimationFrame(updateControl);
        const valueMap = {
            'camera-fov': vis3d.cameraController.camera.fov,
            'camera-x': vis3d.cameraController.camera.position.x,
            'camera-y': vis3d.cameraController.camera.position.y,
            'camera-z': vis3d.cameraController.camera.position.z,
            'lookat-x': vis3d.cameraController.lookAt.x,
            'lookat-y': vis3d.cameraController.lookAt.y,
            'lookat-z': vis3d.cameraController.lookAt.z,
            'smooth': vis3d.cameraController.smooth,
            'autorotate': vis3d.cameraController.autoRotate,
            'ambient-intensity': vis3d.ambientLight.intensity,
            'light-intensity': vis3d.directionalLight.intensity
        };
        for (const id in valueMap) {
            const domElement = document.getElementById(id);
            if (domElement && domElement !== document.activeElement) {
                domElement.value = parseFloat(valueMap[id].toFixed(3));
            }
        }

        const colorMap = {
            'bg-color': vis3d.scene.background,
            'ambient-color': vis3d.ambientLight.color,
            'light-color': vis3d.directionalLight.color
        }
        for (const id in colorMap) {
            const domElement = document.getElementById(id);
            if (domElement && domElement !== document.activeElement) {
                domElement.value = '0x' + colorMap[id].getHexString();
            }
        }

        const statusDOM = document.getElementById("status");
        if (vis3dClient.ws === undefined || vis3dClient.ws.readyState === 1) {
            statusDOM.innerText = 'Connected';
            statusDOM.className = 'success';
        } else {
            statusDOM.innerText = 'Disconnected';
            statusDOM.className = 'error';
        }
    }
    updateControl();

    document.getElementById('control-toggle').addEventListener('click', e => {
        const controlsDOM = document.getElementById('controls');
        if (controlsDOM.className == 'hide') {
            controlsDOM.className = '';
            e.target.value = String.fromCodePoint(0x1f53a);
        } else {
            controlsDOM.className = 'hide';
            e.target.value = String.fromCodePoint(0x1f53b);
        }
    });
    document.getElementById('connect-btn').addEventListener('click', e => {
        vis3dClient.host = document.getElementById('host').value;
        vis3dClient.port = document.getElementById('port').value;
        vis3dClient.connect();
    });
    document.getElementById('camera-fov').addEventListener('change', e => {
        vis3d.cameraController.camera.fov = parseFloat(e.target.value);
        vis3d.cameraController.camera.updateProjectionMatrix();
    });
    document.getElementById('camera-x').addEventListener('change', e => {
        const position = vis3d.cameraController.position.setX(parseFloat(e.target.value));
        vis3d.cameraController.position = position;
    });
    document.getElementById('camera-y').addEventListener('change', e => {
        const position = vis3d.cameraController.position.setY(parseFloat(e.target.value));
        vis3d.cameraController.position = position;
    });
    document.getElementById('camera-z').addEventListener('change', e => {
        const position = vis3d.cameraController.position.setZ(parseFloat(e.target.value));
        vis3d.cameraController.position = position;
    });
    document.getElementById('lookat-x').addEventListener('change', e => {
        const lookAt = vis3d.cameraController.lookAt.setX(parseFloat(e.target.value));
        vis3d.cameraController.lookAt = lookAt;
    });
    document.getElementById('lookat-y').addEventListener('change', e => {
        const lookAt = vis3d.cameraController.lookAt.setY(parseFloat(e.target.value));
        vis3d.cameraController.lookAt = lookAt;
    });
    document.getElementById('lookat-z').addEventListener('change', e => {
        const lookAt = vis3d.cameraController.lookAt.setZ(parseFloat(e.target.value));
        vis3d.cameraController.lookAt = lookAt;
    });
    document.getElementById('autorotate').addEventListener('change', e => {
        vis3d.cameraController.autoRotate = parseFloat(e.target.value);
    });
    document.getElementById('smooth').addEventListener('change', e => {
        vis3d.cameraController.smooth = parseFloat(e.target.value);
    });
    document.getElementById('bg-color').addEventListener('change', e => {
        const colorString = e.target.value;
        const colorInt = parseInt(colorString, 16);
        const color = new THREE.Color( isNaN(colorInt) ? colorString : colorInt );
        vis3d.scene.background = color;
        vis3d.scene.fog.color = color;
        vis3d.groundPlane.obj.material.color = new THREE.Color(color.getHex() ^ 0xffffff);
    });
    document.getElementById('ambient-color').addEventListener('change', e => {
        const colorString = e.target.value;
        const colorInt = parseInt(colorString, 16);
        vis3d.ambientLight.color = new THREE.Color( isNaN(colorInt) ? colorString : colorInt );
    })
    document.getElementById('ambient-intensity').addEventListener('change', e => {
        vis3d.ambientLight.intensity = parseFloat(e.target.value);
    });
    document.getElementById('light-color').addEventListener('change', e => {
        const colorString = e.target.value;
        const colorInt = parseInt(colorString, 16);
        vis3d.directionalLight.color = new THREE.Color( isNaN(colorInt) ? colorString : colorInt );
    })
    document.getElementById('light-intensity').addEventListener('change', e => {
        vis3d.directionalLight.intensity = parseFloat(e.target.value);
    });


    function updateObjects() {
        const objectTable = document.getElementById('object-table');
        const objectDOMs = document.getElementsByClassName('object-row');
        const objectDOMMap = {};
        for (let i = 0; i < objectDOMs.length; ++i) {
            const objectDOM = objectDOMs[i];
            if (vis3d.objects[objectDOM.id] === undefined) {
                objectDOM.remove();
            } else {
                objectDOMMap[objectDOM.id] = objectDOM;
            }
        }

        for (const uuid in vis3d.objects) {
            const obj = vis3d.objects[uuid];
            if (objectDOMMap[uuid] === undefined) {
                // Add new object
                const objectRow = document.createElement('tr');
                objectRow.id = uuid;
                objectRow.className = 'object-row';
                objectRow.innerHTML = 
                    '<td><input type="checkbox" id="' + uuid + '-show"></td>' +
                    '<td id="' + uuid + '-name"></td>' +
                    '<td id="' + uuid + '-type"></td>';
                objectTable.appendChild(objectRow);
            }
            const showDOM = document.getElementById(uuid + '-show')
            showDOM.checked = obj.show;
            showDOM.addEventListener('change', e => {
                if (e.target.checked)
                    vis3d.show(uuid);
                else
                    vis3d.hide(uuid);
            });
            document.getElementById(uuid + '-name').innerText = obj.name;
            document.getElementById(uuid + '-type').innerText = obj.type;
        }
    }
    vis3dClient.addEventListener('change', updateObjects);
    updateObjects();

})();