import {
    KaboomOpt, glType, gcType, TextCompOpt, TextComp, GameObj, RenderPropsType,
    DrawTextOpt, FormattedText, FontData, BitmapFontData, FormattedChar,
    TextAlign, CharTransform, assetsType, appType, gameType, gfxType, Debug,
} from "../types"
import { Vec2, Quad, Color, Rect } from "../math"
import { fetchURL, onLoad } from "../utils"

import { DEF_FONT, DEF_TEXT_CACHE_SIZE, FONT_ATLAS_SIZE, DEF_TEXT_SIZE } from "../constants"
import { loadProgress, getBitmapFont } from "../utils"
import { Texture } from "../classes/Texture"
import { TextCtx } from "../types/text"
import { FontAtlas } from "../types/font"

import { AssetData } from "../classes/AssetData"
import { SpriteData } from "../classes/SpriteData"

import fontFunc from "../functions/font"
import drawFunc from "../functions/draw"

export default (game: gameType, gfx: gfxType, gopt: KaboomOpt, assets: assetsType, gl: glType, gc: gcType, app: appType, debug: Debug, getRenderProps: RenderPropsType): TextCtx => {
    const fontStuff = fontFunc(gopt, assets, gl, gc)

    // TODO: escape
    // eslint-disable-next-line
    const TEXT_STYLE_RE = /\[(?<text>[^\]]*)\]\.(?<style>[\w\.]+)+/g

    function compileStyledText(text: string): {
        charStyleMap: Record<number, {
            localIdx: number,
            styles: string[],
        }>,
        text: string,
    } {

        const charStyleMap = {}
        // get the text without the styling syntax
        const renderText = text.replace(TEXT_STYLE_RE, "$1")
        let idxOffset = 0

        // put each styled char index into a map for easy access when iterating each char
        for (const match of text.matchAll(TEXT_STYLE_RE)) {
            const styles = match.groups.style.split(".")
            const origIdx = match.index - idxOffset
            for (
                let i = origIdx;
                i < match.index + match.groups.text.length;
                i++
            ) {
                charStyleMap[i] = {
                    localIdx: i - origIdx,
                    styles: styles,
                }
            }
            // omit "[", "]", "." and the style text in the format string when calculating index
            idxOffset += 3 + match.groups.style.length
        }

        return {
            charStyleMap: charStyleMap,
            text: renderText,
        }

    }

    function alignPt(align: TextAlign): number {
        switch (align) {
            case "left": return 0
            case "center": return 0.5
            case "right": return 1
            default: return 0
        }
    }

    function applyCharTransform(fchar: FormattedChar, tr: CharTransform) {
        if (tr.pos) fchar.pos = fchar.pos.add(tr.pos)
        if (tr.scale) fchar.scale = fchar.scale.scale(new Vec2(tr.scale))
        if (tr.angle) fchar.angle += tr.angle
        if (tr.color) fchar.color = fchar.color.mult(tr.color)
        if (tr.opacity) fchar.opacity *= tr.opacity
    }

    // TODO: cache formatted text
    // format text and return a list of chars with their calculated position
    function formatText(opt: DrawTextOpt): FormattedText {

        if (opt.text === undefined) {
            throw new Error("formatText() requires property \"text\".")
        }

        let font = fontStuff.resolveFont(opt.font)

        // if it's still loading
        if (opt.text === "" || font instanceof AssetData || !font) {
            return {
                width: 0,
                height: 0,
                chars: [],
                opt: opt,
            }
        }

        const { charStyleMap, text } = compileStyledText(opt.text + "")
        const chars = text.split("")

        // if it's not bitmap font, we draw it with 2d canvas or use cached image
        if (font instanceof FontFace || typeof font === "string") {

            const fontName = font instanceof FontFace ? font.family : font

            const atlas: FontAtlas = fontStuff.fontAtlases[fontName] ?? {
                font: {
                    tex: new Texture(FONT_ATLAS_SIZE, FONT_ATLAS_SIZE,
                        gl, gc, gopt,
                        {
                            filter: "linear",
                        }),
                    map: {},
                    size: DEF_TEXT_CACHE_SIZE,
                },
                cursor: new Vec2(0),
            }

            if (!fontStuff.fontAtlases[fontName]) {
                fontStuff.fontAtlases[fontName] = atlas
            }

            font = atlas.font

            for (const ch of chars) {

                if (!atlas.font.map[ch]) {

                    const c2d = app.canvas2.getContext("2d")
                    c2d.font = `${font.size}px ${fontName}`
                    c2d.clearRect(0, 0, app.canvas2.width, app.canvas2.height)
                    c2d.textBaseline = "top"
                    c2d.textAlign = "left"
                    c2d.fillStyle = "rgb(255, 255, 255)"
                    c2d.fillText(ch, 0, 0)
                    const m = c2d.measureText(ch)
                    const w = Math.ceil(m.width)
                    const img = c2d.getImageData(0, 0, w, font.size)

                    // if we are about to exceed the X axis of the texture, go to another line
                    if (atlas.cursor.x + w > FONT_ATLAS_SIZE) {
                        atlas.cursor.x = 0
                        atlas.cursor.y += font.size
                        if (atlas.cursor.y > FONT_ATLAS_SIZE) {
                            // TODO: create another tex
                            throw new Error("Font atlas exceeds character limit")
                        }
                    }

                    font.tex.update(atlas.cursor.x, atlas.cursor.y, img)
                    font.map[ch] = new Quad(atlas.cursor.x, atlas.cursor.y, w, font.size)
                    atlas.cursor.x += w

                }

            }

        }

        const size = opt.size || font.size
        const scale = new Vec2(opt.scale ?? 1).scale(size / font.size)
        const lineSpacing = opt.lineSpacing ?? 0
        const letterSpacing = opt.letterSpacing ?? 0
        let curX = 0
        let tw = 0
        let th = 0
        const lines: Array<{
            width: number,
            chars: FormattedChar[],
        }> = []
        let curLine: FormattedChar[] = []
        let cursor = 0
        let lastSpace = null
        let lastSpaceWidth = null

        // TODO: word break
        while (cursor < chars.length) {

            let ch = chars[cursor]

            // always new line on '\n'
            if (ch === "\n") {

                th += size + lineSpacing

                lines.push({
                    width: curX - letterSpacing,
                    chars: curLine,
                })

                lastSpace = null
                lastSpaceWidth = null
                curX = 0
                curLine = []

            } else {

                let q = font.map[ch]

                // TODO: leave space if character not found?
                if (q) {

                    let gw = q.w * scale.x

                    if (opt.width && curX + gw > opt.width) {
                        // new line on last word if width exceeds
                        th += size + lineSpacing
                        if (lastSpace != null) {
                            cursor -= curLine.length - lastSpace
                            ch = chars[cursor]
                            q = font.map[ch]
                            gw = q.w * scale.x
                            // omit trailing space
                            curLine = curLine.slice(0, lastSpace - 1)
                            curX = lastSpaceWidth
                        }
                        lastSpace = null
                        lastSpaceWidth = null
                        lines.push({
                            width: curX - letterSpacing,
                            chars: curLine,
                        })
                        curX = 0
                        curLine = []
                    }

                    // push char
                    curLine.push({
                        tex: font.tex,
                        width: q.w,
                        height: q.h,
                        // without some padding there'll be visual artifacts on edges
                        quad: new Quad(
                            q.x / font.tex.width,
                            q.y / font.tex.height,
                            q.w / font.tex.width,
                            q.h / font.tex.height,
                        ),
                        ch: ch,
                        pos: new Vec2(curX, th),
                        opacity: opt.opacity ?? 1,
                        color: opt.color ?? Color.WHITE,
                        scale: new Vec2(scale),
                        angle: 0,
                    })

                    if (ch === " ") {
                        lastSpace = curLine.length
                        lastSpaceWidth = curX
                    }

                    curX += gw
                    tw = Math.max(tw, curX)
                    curX += letterSpacing

                }

            }

            cursor++

        }

        lines.push({
            width: curX - letterSpacing,
            chars: curLine,
        })

        th += size

        if (opt.width) {
            tw = opt.width
        }

        const fchars: FormattedChar[] = []

        for (const line of lines) {

            const ox = (tw - line.width) * alignPt(opt.align ?? "left")

            for (const fchar of line.chars) {

                const q = font.map[fchar.ch]
                const idx = fchars.length

                const offset = new Vec2(
                    q.w * scale.x * 0.5,
                    q.h * scale.y * 0.5,
                )

                fchar.pos = fchar.pos.add(new Vec2(ox, 0)).add(offset)

                if (opt.transform) {
                    const tr = typeof opt.transform === "function"
                        ? opt.transform(idx, fchar.ch)
                        : opt.transform
                    if (tr) {
                        applyCharTransform(fchar, tr)
                    }
                }

                if (charStyleMap[idx]) {
                    const { styles, localIdx } = charStyleMap[idx]
                    for (const name of styles) {
                        const style = opt.styles[name]
                        const tr = typeof style === "function"
                            ? style(localIdx, fchar.ch)
                            : style
                        if (tr) {
                            applyCharTransform(fchar, tr)
                        }
                    }
                }

                fchars.push(fchar)

            }

        }

        return {
            width: tw,
            height: th,
            chars: fchars,
            opt: opt,
        }
    }

    function fetchText(path: string) {
        return fetchURL(assets, path).then((res) => res.text())
    }

    function text(t: string, opt: TextCompOpt = {}): TextComp {

        function update(obj: GameObj<TextComp | any>) {
            const ftext = formatText({
                ...getRenderProps(obj),
                text: obj.text + "",
                size: obj.textSize,
                font: obj.font,
                width: opt.width && obj.width,
                align: obj.align,
                letterSpacing: obj.letterSpacing,
                lineSpacing: obj.lineSpacing,
                transform: obj.textTransform,
                styles: obj.textStyles,
            })

            if (!opt.width) {
                obj.width = ftext.width / (obj.scale?.x || 1)
            }

            obj.height = ftext.height / (obj.scale?.y || 1)

            return ftext

        }

        return {

            id: "text",
            text: t,
            textSize: opt.size ?? DEF_TEXT_SIZE,
            font: opt.font,
            width: opt.width,
            height: 0,
            align: opt.align,
            lineSpacing: opt.lineSpacing,
            letterSpacing: opt.letterSpacing,
            textTransform: opt.transform,
            textStyles: opt.styles,

            add(this: GameObj<TextComp>) {
                onLoad(game, assets, () => update(this))
            },

            draw(this: GameObj<TextComp>) {
                const DRAW = drawFunc(gopt, gfx, assets, game, app, debug, gl, gc, getRenderProps)

                DRAW.drawFormattedText(update(this))
            },

            renderArea() {
                return new Rect(new Vec2(0), this.width, this.height)
            },
        }
    }

    return { formatText, text, fetchText }
}
