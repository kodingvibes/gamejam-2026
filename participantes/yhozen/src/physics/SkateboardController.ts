import { THREE, type ExtendedMesh } from '@enable3d/phaser-extension';
import type { Scene3D } from '@enable3d/phaser-extension';
import type { TuningValues } from '../game/config';
import { OLLIE_IMPULSE, PLAYER_MASS, SOFT_SPEED_CAP } from '../game/config';
import { headingTowardCenter, planarBrakingImpulse } from '../game/movement';
import type { PlayerState, Vec3 } from '../shared/protocol';

declare const Ammo: any;

export interface SkateInput {
  forward: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  ollie: boolean;
}

export class SkateboardController {
  readonly chassis: ExtendedMesh;
  private readonly third: Scene3D['third'];
  private readonly vehicle: any;
  private readonly wheelGroups: THREE.Group[] = [];
  private ollieHeld = false;

  constructor(third: Scene3D['third'], spawn: readonly [number, number, number], private tuning: TuningValues) {
    this.third = third;
    const deckTexture = new THREE.TextureLoader().load('/assets/deck-grip.png');
    deckTexture.colorSpace = THREE.SRGBColorSpace;
    deckTexture.anisotropy = Math.min(8, third.renderer.capabilities.getMaxAnisotropy());
    this.chassis = third.physics.add.box(
      {
        name: 'local-board',
        x: spawn[0],
        y: spawn[1],
        z: spawn[2],
        width: 0.72,
        height: 0.16,
        depth: 1.75,
        mass: PLAYER_MASS,
      },
      {
        custom: new THREE.MeshStandardMaterial({
          map: deckTexture,
          color: 0xd7f7ee,
          roughness: 0.88,
          metalness: 0.02,
        }),
      },
    );
    this.chassis.body.setDamping(0.04, 0.55);
    this.chassis.body.setFriction(0.85);
    this.chassis.body.setRestitution(0.05);
    this.chassis.body.setCcdMotionThreshold(0.4);
    this.chassis.body.setCcdSweptSphereRadius(0.12);
    this.chassis.body.skipUpdate = true;

    const vehicleTuning = new Ammo.btVehicleTuning();
    const rayCaster = new Ammo.btDefaultVehicleRaycaster(third.physics.physicsWorld);
    this.vehicle = new Ammo.btRaycastVehicle(vehicleTuning, this.chassis.body.ammo, rayCaster);
    this.vehicle.setCoordinateSystem(0, 1, 2);
    third.physics.physicsWorld.addAction(this.vehicle);

    const wheelPositions: Array<[number, number, number, boolean]> = [
      [-0.29, 0, -0.58, true],
      [0.29, 0, -0.58, true],
      [-0.29, 0, 0.58, false],
      [0.29, 0, 0.58, false],
    ];
    wheelPositions.forEach(([x, y, z, front]) => this.addWheel(x, y, z, front, vehicleTuning));
    this.respawn(spawn);
  }

  setTuning(tuning: TuningValues): void {
    this.tuning = tuning;
    for (let index = 0; index < 4; index += 1) {
      this.vehicle.getWheelInfo(index).set_m_frictionSlip(tuning.grip);
    }
  }

  update(input: SkateInput, deltaSeconds = 1 / 60): void {
    const velocity = this.chassis.body.velocity;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const engine = input.forward && horizontalSpeed < SOFT_SPEED_CAP ? -this.tuning.pushForce : 0;
    const brake = input.brake ? this.tuning.brakeForce : 0;
    const steering = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAmount = steering * this.tuning.steering * Math.min(1, 0.3 + horizontalSpeed / 8);

    this.vehicle.applyEngineForce(engine, 2);
    this.vehicle.applyEngineForce(engine, 3);
    for (let index = 0; index < 4; index += 1) this.vehicle.setBrake(brake * 0.35, index);
    if (input.brake) {
      const [impulseX, , impulseZ] = planarBrakingImpulse(
        [velocity.x, velocity.y, velocity.z],
        this.tuning.brakeForce,
        PLAYER_MASS,
        deltaSeconds,
      );
      this.chassis.body.applyCentralImpulse(impulseX, 0, impulseZ);
    }
    this.vehicle.setSteeringValue(steerAmount, 0);
    this.vehicle.setSteeringValue(steerAmount, 1);

    if (input.ollie && !this.ollieHeld && this.grounded) {
      this.chassis.body.applyCentralImpulse(0, OLLIE_IMPULSE, 0);
    }
    this.ollieHeld = input.ollie;
    this.syncVisuals();
  }

  applyRecoil(direction: THREE.Vector3, impulse: number): void {
    this.chassis.body.applyCentralImpulse(
      -direction.x * impulse,
      -direction.y * impulse,
      -direction.z * impulse,
    );
  }

  respawn(spawn: readonly [number, number, number]): void {
    const headingToCenter = headingTowardCenter(spawn);
    const transform = this.chassis.body.ammo.getWorldTransform();
    transform.setOrigin(new Ammo.btVector3(spawn[0], spawn[1], spawn[2]));
    transform.setRotation(new Ammo.btQuaternion(
      0,
      Math.sin(headingToCenter / 2),
      0,
      Math.cos(headingToCenter / 2),
    ));
    this.chassis.body.ammo.setWorldTransform(transform);
    this.chassis.body.ammo.getMotionState()?.setWorldTransform(transform);
    this.chassis.body.setVelocity(0, 0, 0);
    this.chassis.body.setAngularVelocity(0, 0, 0);
    this.vehicle.resetSuspension();
    this.syncVisuals();
  }

  get grounded(): boolean {
    for (let index = 0; index < 4; index += 1) {
      const raycastInfo = this.vehicle.getWheelInfo(index).get_m_raycastInfo();
      if (raycastInfo.get_m_isInContact()) return true;
    }
    return false;
  }

  get speed(): number {
    const velocity = this.chassis.body.velocity;
    return Math.hypot(velocity.x, velocity.y, velocity.z);
  }

  get heading(): number {
    return new THREE.Euler().setFromQuaternion(this.chassis.quaternion, 'YXZ').y;
  }

  getState(cameraRotation: THREE.Euler): PlayerState {
    const velocity = this.chassis.body.velocity;
    return {
      position: [this.chassis.position.x, this.chassis.position.y, this.chassis.position.z],
      velocity: [velocity.x, velocity.y, velocity.z],
      rotation: [cameraRotation.x, cameraRotation.y, cameraRotation.z],
    };
  }

  getVelocity(): Vec3 {
    const velocity = this.chassis.body.velocity;
    return [velocity.x, velocity.y, velocity.z];
  }

  destroy(): void {
    this.third.physics.physicsWorld.removeAction(this.vehicle);
    this.wheelGroups.forEach((wheel) => this.third.scene.remove(wheel));
  }

  private addWheel(x: number, y: number, z: number, front: boolean, tuning: any): void {
    const info = this.vehicle.addWheel(
      new Ammo.btVector3(x, y, z),
      new Ammo.btVector3(0, -1, 0),
      new Ammo.btVector3(-1, 0, 0),
      0.16,
      0.12,
      tuning,
      front,
    );
    info.set_m_suspensionStiffness(70);
    info.set_m_wheelsDampingRelaxation(2.5);
    info.set_m_wheelsDampingCompression(4.8);
    info.set_m_frictionSlip(this.tuning.grip);
    info.set_m_rollInfluence(0.06);

    const group = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: 0x83ffc3, roughness: 0.45, metalness: 0.1 }),
    );
    tire.rotation.z = Math.PI / 2;
    group.add(tire);
    this.third.scene.add(group);
    this.wheelGroups.push(group);
  }

  private syncVisuals(): void {
    const transform = this.vehicle.getChassisWorldTransform();
    const origin = transform.getOrigin();
    const rotation = transform.getRotation();
    this.chassis.position.set(origin.x(), origin.y(), origin.z());
    this.chassis.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());

    this.wheelGroups.forEach((wheel, index) => {
      this.vehicle.updateWheelTransform(index, true);
      const wheelTransform = this.vehicle.getWheelTransformWS(index);
      const wheelOrigin = wheelTransform.getOrigin();
      const wheelRotation = wheelTransform.getRotation();
      wheel.position.set(wheelOrigin.x(), wheelOrigin.y(), wheelOrigin.z());
      wheel.quaternion.set(wheelRotation.x(), wheelRotation.y(), wheelRotation.z(), wheelRotation.w());
    });
  }
}
