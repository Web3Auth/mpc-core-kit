import { Point as TkeyPoint } from "@tkey-mpc/common-types";
import type { BNString } from "@toruslabs/torus.js";
import BN from "bn.js";
import { curve } from "elliptic";

import { CURVE } from "./constants";

type EllipticPoint = curve.base.BasePoint;
const ZERO_POINT = CURVE.g.mul(new BN(0)) as EllipticPoint;

/**
 * Class `Point` represents an elliptic curve point over curve `CURVE`.
 */
export class Point {
  private p: EllipticPoint;

  /**
   * Constructs a new Point from an elliptic point.
   * @param p - The elliptic point to be represented.
   */
  constructor(p: EllipticPoint) {
    this.p = p;
  }

  /**
   * Creates a new Point from a private Key.
   * @param p - The TKey Point.
   * @returns The Point encoded by `p`.
   */
  public static fromPrivateKey(privateKey: BNString): Point {
    const ep = CURVE.keyFromPrivate(privateKey.toString("hex")).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from a TKey Point.
   * @param p - The TKey Point.
   * @returns The Point encoded by `p`.
   */
  public static fromTkeyPoint(p: TkeyPoint): Point {
    const ep = CURVE.keyFromPublic({ x: p.x.toString("hex"), y: p.y.toString("hex") }).getPublic();
    return new Point(ep);
  }

  /**
   * Creates a new Point from an SEC1-encoded byte buffer.
   * @param buf - The SEC1-encoded point.
   * @returns The Point encoded by `buf`.
   */
  public static fromBufferSEC1(buf: Buffer): Point {
    // "elliptic"@6.5.4 can't decode zero point.
    if (buf.length === 1 && buf[0] === 0) {
      return new Point(ZERO_POINT);
    }

    const p = CURVE.keyFromPublic(buf.toString("hex"), "hex").getPublic();
    return new Point(p);
  }

  /**
   * Converts this point to a TKey Point.
   * @returns A TKey Point representing this point.
   * @throws If this point cannot be represented by a TKey Point. For example,
   * if this point encodes the point at infinity.
   */
  public toTkeyPoint(): TkeyPoint {
    if (this.p.isInfinity()) {
      throw new Error("Point at infinity can't be represented as tkey point.");
    }

    const x = this.p.getX().toString("hex");
    const y = this.p.getY().toString("hex");
    return new TkeyPoint(x, y);
  }

  /**
   * Converts this point to a byte buffer in SEC1 format.
   * @param compressed - Whether to use compressed format.
   * @returns The SEC1-encoded representation of the point.
   */
  public toBufferSEC1(compressed: boolean): Buffer {
    // "elliptic"@6.5.4 can't encode zero point.
    if (this.p.isInfinity()) {
      return Buffer.from("00", "hex");
    }

    return Buffer.from(this.p.encode("hex", compressed), "hex");
  }

  /**
   * Checks for point equality between `this` and `p`.
   * @param p - The point to compare to.
   * @returns True if `this == p`. False otherwise.
   */
  public equals(p: Point): boolean {
    return this.p.eq(p.p);
  }
}
