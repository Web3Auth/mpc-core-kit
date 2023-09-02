import { Point as TkeyPoint } from "@tkey-mpc/common-types";
import BN from "bn.js";
import { curve } from "elliptic";

import { CURVE, FIELD_ELEMENT_HEX_LEN } from "./constants";

type EllipticPoint = curve.base.BasePoint;
const ZERO_POINT = CURVE.g.mul(new BN(0)) as EllipticPoint;

export class Point {
  private p: EllipticPoint;

  constructor(p: EllipticPoint) {
    this.p = p;
  }

  public static fromTkeyPoint(p: TkeyPoint): Point {
    const ep = CURVE.keyFromPublic({ x: p.x.toString("hex"), y: p.y.toString("hex") }).getPublic();
    return new Point(ep);
  }

  public static fromBufferSEC1(buf: Buffer): Point {
    // "elliptic"@6.5.4 can't decode zero point.
    if (buf.length === 1 && buf[0] === 0) {
      return new Point(ZERO_POINT);
    }

    const p = CURVE.keyFromPublic(buf.toString("hex"), "hex").getPublic();
    return new Point(p);
  }

  public asTkeyPoint(): TkeyPoint {
    if (this.p.isInfinity()) {
      throw new Error("Point at infinity can't be represented as tkey point.");
    }

    const x = this.p.getX().toString("hex");
    const y = this.p.getY().toString("hex");
    return new TkeyPoint(x, y);
  }

  public encodeSEC1(compressed: boolean): Buffer {
    if (this.p.isInfinity()) {
      return Buffer.from("00", "hex");
    } else if (compressed) {
      return Buffer.from(this.p.encodeCompressed("hex"), "hex");
    }

    // Not infinity, uncompressed.
    return Buffer.concat([
      Buffer.from("04", "hex"),
      Buffer.from(this.p.getX().toString(16, FIELD_ELEMENT_HEX_LEN), "hex"),
      Buffer.from(this.p.getY().toString(16, FIELD_ELEMENT_HEX_LEN), "hex"),
    ]);
  }
}
