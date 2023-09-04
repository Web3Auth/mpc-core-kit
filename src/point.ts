import { Point as TkeyPoint } from "@tkey-mpc/common-types";
import BN from "bn.js";
import { curve } from "elliptic";

import { CURVE } from "./constants";

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

  public toTkeyPoint(): TkeyPoint {
    if (this.p.isInfinity()) {
      throw new Error("Point at infinity can't be represented as tkey point.");
    }

    const x = this.p.getX().toString("hex");
    const y = this.p.getY().toString("hex");
    return new TkeyPoint(x, y);
  }

  public toBufferSEC1(compressed: boolean): Buffer {
    // "elliptic"@6.5.4 can't encode zero point.
    if (this.p.isInfinity()) {
      return Buffer.from("00", "hex");
    }

    return Buffer.from(this.p.encode("hex", compressed), "hex");
  }
}
