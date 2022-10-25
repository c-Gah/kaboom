import { KaboomNetworkCtx, KaboomOpt, PosCoreComp, MoveComp } from "./types"
import { Vec2 } from "./math"
import socketFunc from "./functions/network/socketio"
import kaboomCore from "./kaboomCore"

import Timer from "./timer"

// only exports one kaboom() which contains all the state
export default (gopt: KaboomOpt = {}): KaboomNetworkCtx => {
    const core = kaboomCore(gopt)
    const server = kaboomCore(gopt)


    const oldMove = core.move


    //server.pos = function (x?: number | Vec2, y?: number): PosCoreComp {
    server.pos = function (x?: number | Vec2, y?: number) {
        var test: PosCoreComp
        if (x) {
            if (typeof x === "number") {
                test = { ...core.pos(x, y) }
            } else {
                test = { ...core.pos(x) }
            }
        } else {
            test = { ...core.pos() }
        }


        /*
        const move2 = function (xVel: Vec2 | number, yVel?: number) {
            //console.log("dsadadsadad")
            if (typeof xVel === "number") {
                test.move(xVel, yVel)
            } else {
                test.move(xVel)
            }
        }
        */

        const move = function (this: any, xVel: Vec2 | number, yVel?: number, stopRecur = false) {
            if (stopRecur) {
                return
            }
            //const move = (this: any) => {
            //this.move(xVel, yVel, true)
            this.move(xVel, yVel, true)
        }
        //test.move2 = JSON.parse(JSON.stringify(test2))

        console.log("fdsfdsfdsfsd")

        return {
            ...test,
            //...this,
            move
        }
    }
    /*
    // Extending it by replacing and wrapping, in extended.js
    server.pos = (function (old) {
        function extendsInit() {
            const oldPos = old();
            const oldPosMove = oldPos.move;

            oldPos.move = function (xVel: Vec2 | number, yVel?: number) {
                //console.log("aaaaaaaaaaaaaaaaa")

                if (typeof xVel === "number") {
                    oldPosMove(xVel, yVel)
                } else {
                    oldPosMove(xVel)
                }
            }

            return { ...oldPos }
        }

        return extendsInit;
    })(core.pos);
*/

    //const socketStuff = socketFunc()

    // the exported ctx handle
    const ctx: KaboomNetworkCtx = {
        ...server,
        socketFunc
    }


    return ctx

}
