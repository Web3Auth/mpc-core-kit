/// <reference types="node" />
import { Point as TkeyPoint } from "@tkey-mpc/common-types";
import type { BNString } from "@toruslabs/torus.js";
import { curve } from "elliptic";
type EllipticPoint = curve.base.BasePoint;
/**
 * Class `Point` represents an elliptic curve point over curve `CURVE`.
 */
export declare class Point {
    private p;
    /**
     * Constructs a new Point from an elliptic point.
     * @param p - The elliptic point to be represented.
     */
    constructor(p: EllipticPoint);
    /**
     * Creates a new Point from a private Key.
     * @param p - The TKey Point.
     * @returns The Point encoded by `p`.
     */
    static fromPrivateKey(privateKey: BNString): Point;
    /**
     * Creates a new Point from a TKey Point.
     * @param p - The TKey Point.
     * @returns The Point encoded by `p`.
     */
    static fromTkeyPoint(p: TkeyPoint): Point;
    /**
     * Creates a new Point from an SEC1-encoded byte buffer.
     * @param buf - The SEC1-encoded point.
     * @returns The Point encoded by `buf`.
     */
    static fromBufferSEC1(buf: Buffer): Point;
    /**
     * Converts this point to a TKey Point.
     * @returns A TKey Point representing this point.
     * @throws If this point cannot be represented by a TKey Point. For example,
     * if this point encodes the point at infinity.
     */
    toTkeyPoint(): TkeyPoint;
    /**
     * Converts this point to a byte buffer in SEC1 format.
     * @param compressed - Whether to use compressed format.
     * @returns The SEC1-encoded representation of the point.
     */
    toBufferSEC1(compressed: boolean): Buffer;
    /**
     * Checks for point equality between `this` and `p`.
     * @param p - The point to compare to.
     * @returns True if `this == p`. False otherwise.
     */
    equals(p: Point): boolean;
}
export {};
