import * as THREE from 'three';
import { OFFICE_LAYOUT } from '../../../shared/maps/office.js';
import { load } from './kit.js';
import { placeSizedOfficeModel } from './office-fixtures.js';

// Read from the far end toward the entrance. Within a bank each line is one
// side of the divider, with seats listed from left to right.
const deskProps = [
  {
    left: [
      ['lampRoundTable', 'books', 'laptop', 'plantSmall3'],
      ['plantSmall1', 'radio', 'books', 'bear'],
    ],
    right: [
      ['laptop', 'speakerSmall', 'plantSmall2'],
      ['books', 'lampSquareTable', 'laptop'],
    ],
  },
  {
    left: [
      ['books', 'plantSmall2', 'speakerSmall', 'lampSquareTable'],
      ['laptop', 'plantSmall3', 'bear', 'radio'],
    ],
    right: [
      ['plantSmall1', 'lampRoundTable', 'laptop'],
      ['speakerSmall', 'books', 'plantSmall3'],
    ],
  },
  {
    left: [
      ['radio', 'books', 'lampRoundTable', 'laptop'],
      ['plantSmall2', 'laptop', 'lampSquareTable', 'bear'],
    ],
    right: [
      ['speakerSmall', 'plantSmall3', 'books'],
      ['laptop', 'radio', 'plantSmall1'],
    ],
  },
  {
    left: [
      ['plantSmall3', 'laptop', 'books', 'speakerSmall'],
      ['lampSquareTable', 'plantSmall1', 'laptop', 'radio'],
    ],
    right: [
      ['laptop', 'bear', 'lampRoundTable'],
      [null, null, null], // The polygon version already puts a mug, books and a cactus here.
    ],
  },
];

const propScale = {
  laptop: 1.4,
  books: 2,
  plantSmall1: 2,
  plantSmall2: 2,
  plantSmall3: 2,
  lampRoundTable: 1.4,
  lampSquareTable: 1.4,
  speakerSmall: 1,
  bear: 0.72,
  radio: 1.1,
};

export async function addDeskDetails(scene, mergeStatic) {
  const { deskPartitions, deskSections } = OFFICE_LAYOUT;
  const details = new THREE.Group();
  const fabric = new THREE.MeshLambertMaterial({ color: 0x8faaa0 });
  const trim = new THREE.MeshLambertMaterial({ color: 0x516861 });
  const capHeight = 0.026;
  for (const { x, z, w, d, y, h } of deskPartitions) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h - capHeight, d), fabric);
    panel.position.set(x, y + (h - capHeight) / 2, z);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, capHeight, d), trim);
    cap.position.set(x, y + h - capHeight / 2, z);
    details.add(panel, cap);
  }

  const props = [];
  for (const [index, section] of deskSections.entries()) {
    for (const bank of ['left', 'right']) {
      for (const [row, side] of [-1, 1].entries()) {
        const seats = section[bank].filter((desk) => Math.sign(desk.z - section.z) === side);
        for (const [column, seat] of seats.entries()) {
          const name = deskProps[index][bank][row][column];
          if (name) props.push(placeDeskProp(details, name, seat, side));
        }
      }
    }
  }

  for (const { z: rowZ, left, right } of deskSections) {
    for (const desk of [...left, ...right]) {
      const side = Math.sign(desk.z - rowZ);
      props.push(placeSizedOfficeModel(details, 'computerMouse',
        desk.x + side * 0.43, desk.h, desk.z + side * 0.18, 0.12, 0.055, 0.2, desk.q));
    }

    const farLeftSeats = left.filter((desk) => desk.z < rowZ);
    const nearRightSeats = right.filter((desk) => desk.z > rowZ);
    for (const desk of [farLeftSeats[2], nearRightSeats[1]]) {
      const side = Math.sign(desk.z - rowZ);
      props.push(placeSizedOfficeModel(details, 'computerScreen',
        desk.x + side * 0.58, desk.h, desk.z - side * 0.28, 0.41, 0.4, 0.15, desk.q));
    }

    for (const desk of [farLeftSeats[1], nearRightSeats[2]]) {
      const side = Math.sign(desk.z - rowZ);
      props.push(placeSizedOfficeModel(details, 'lampRoundTable',
        desk.x + side * 0.58, desk.h, desk.z - side * 0.27, 0.21, 0.43, 0.22, desk.q));
    }
  }

  await Promise.all(props);
  scene.add(mergeStatic(details));
}

async function placeDeskProp(group, name, desk, side) {
  const model = await load('furniture-kit', name);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const prop = new THREE.Group();
  prop.add(model);
  prop.scale.setScalar(propScale[name]);
  prop.rotation.y = side > 0 ? 0 : Math.PI;
  prop.position.set(desk.x - side * 0.56, desk.h, desk.z);
  group.add(prop);
}
