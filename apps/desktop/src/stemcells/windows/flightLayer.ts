/**
 * Stemcells: the flight layer (stemcells/tasks/windows.md, The flight
 * layer). What a carry shows outside any window, a chip or a window preview
 * in the hand, is drawn on a transparent, click-through window over each
 * display, made as the snapshot overlay makes one. It draws boxes and
 * stills and nothing else: the page that carries sends what to draw and
 * how it moves, resolved from its motion tokens.
 *
 * A layer lives for one flight. Kept between flights, a hidden layer would
 * be the "first window" upstream reveals on a Dock click when no app window
 * is open.
 */
import * as Electron from "electron";

import type { FlightCommand, FlightRect } from "./channels.ts";

/** A still bigger than this many pixels is sent as a JPEG, which is quicker to make than a PNG. */
const PNG_MOST_PIXELS = 200_000;

/**
 * Commands waiting for their layer: a `place` replaces the one before it
 * when nothing else has come for the same thing since, so the layer is
 * always sent the latest hand, never a backlog of old ones.
 */
export function queueCommands(
  pending: ReadonlyArray<FlightCommand>,
  incoming: ReadonlyArray<FlightCommand>,
): FlightCommand[] {
  const queue = [...pending];
  for (const command of incoming) {
    const last = queue.findLastIndex((queued) => queued.id === command.id);
    if (command.op === "place" && last >= 0 && queue[last]!.op === "place") queue.splice(last, 1);
    queue.push(command);
  }
  return queue;
}

/** The layer's page: draws commands in screen points, less its display's origin. */
export function layerHtml(origin: { readonly x: number; readonly y: number }): string {
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
.item{position:absolute;box-sizing:border-box;margin:0}
</style><script>
const origin=${JSON.stringify({ x: origin.x, y: origin.y })},items=new Map();
const at=(command,rect)=>command.parent||items.get(command.id)?.dataset.parent?rect:{...rect,x:rect.x-origin.x,y:rect.y-origin.y};
const setRect=(el,rect)=>Object.assign(el.style,{left:rect.x+"px",top:rect.y+"px",width:rect.width+"px",height:rect.height+"px"});
const now=el=>{const s=getComputedStyle(el);return{left:s.left,top:s.top,width:s.width,height:s.height,opacity:s.opacity,borderRadius:s.borderRadius}};
const make=(tag,command)=>{
  let el=items.get(command.id);
  if(!el){
    el=document.createElement(tag);el.className="item";el.dataset.id=command.id;
    if(command.parent)el.dataset.parent=command.parent;
    (items.get(command.parent)??document.body).append(el);items.set(command.id,el);
  }
  return el;
};
const decoding=[];
const run=command=>{
  const el=items.get(command.id);
  switch(command.op){
    case "box":{
      const box=make("div",command);
      Object.assign(box.style,{background:command.color,borderRadius:command.radius+"px",overflow:command.clip?"hidden":"visible",boxShadow:command.shadow?"0 22px 70px rgba(0,0,0,.45),0 0 0 .5px rgba(0,0,0,.6)":"none"});
      setRect(box,at(command,command.rect));return;
    }
    case "still":{
      const still=make("img",command);still.src=command.still;still.style.borderRadius=(command.radius??0)+"px";setRect(still,at(command,command.rect));
      decoding.push(still.decode().catch(()=>undefined));return;
    }
    case "place":{
      if(!el)return;for(const animation of el.getAnimations())animation.cancel();setRect(el,at(command,command.rect));return;
    }
    case "animate":{
      if(!el)return;
      const from=now(el);
      for(const animation of el.getAnimations())animation.cancel();
      if(command.rect)setRect(el,at(command,command.rect));
      if(command.opacity!==undefined)el.style.opacity=String(command.opacity);
      if(command.radius!==undefined)el.style.borderRadius=command.radius+"px";
      const to=now(el);
      el.animate([from,to],{duration:command.timing.duration,easing:command.timing.easing,delay:command.timing.delay??0,fill:"backwards"});
      return;
    }
    case "remove":{
      if(!el)return;for(const child of el.querySelectorAll(".item"))items.delete(child.dataset.id);
      el.remove();items.delete(command.id);return;
    }
  }
};
// Answers once the stills are decoded and the frame they're in is drawn.
window.flight=async commands=>{
  for(const command of commands)run(command);
  await Promise.all(decoding.splice(0));
  // A page that isn't drawing has no frames to wait for.
  await new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(resolve));setTimeout(resolve,100)});
};
</script>`;
}

interface Layer {
  readonly window: Electron.BrowserWindow;
  readonly ready: Promise<unknown>;
  pending: FlightCommand[];
  /** The batch on its way to the page, if one is. */
  sending: Promise<unknown> | null;
}

function createLayer(display: Electron.Display): Layer {
  const window = new Electron.BrowserWindow({
    ...display.bounds,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    enableLargerThanScreen: true,
    focusable: false,
    frame: false,
    hasShadow: false,
    movable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setAlwaysOnTop(true, "pop-up-menu");
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
  window.setIgnoreMouseEvents(true);
  const ready = window
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(layerHtml(display.bounds))}`)
    .then(() => {
      if (!window.isDestroyed()) window.showInactive();
    })
    .catch(() => undefined);
  return { window, ready, pending: [], sending: null };
}

export class FlightLayer {
  private layers: Layer[] = [];
  private readonly stills = new Map<string, string>();
  private nextStill = 0;

  /** Opens a layer over each display, once per flight. */
  begin(): void {
    if (this.layers.length > 0) return;
    this.layers = Electron.screen.getAllDisplays().map(createLayer);
  }

  /** Draws `commands` on every layer, in order, each with its stills. */
  run(commands: ReadonlyArray<FlightCommand>): void {
    this.begin();
    for (const layer of this.layers) {
      layer.pending = queueCommands(layer.pending, commands);
      this.send(layer);
    }
  }

  private send(layer: Layer): void {
    if (layer.sending || layer.pending.length === 0 || layer.window.isDestroyed()) return;
    const batch = layer.pending.map((command) =>
      command.op === "still"
        ? { ...command, still: this.stills.get(command.still) ?? "" }
        : command,
    );
    layer.pending = [];
    layer.sending = layer.ready
      .then(() =>
        layer.window.isDestroyed()
          ? undefined
          : layer.window.webContents.executeJavaScript(`window.flight(${JSON.stringify(batch)})`),
      )
      .catch(() => undefined)
      .finally(() => {
        layer.sending = null;
        this.send(layer);
      });
  }

  /** A still of `rect` (screen points) of `window`, for `still` commands to show. */
  async still(window: Electron.BrowserWindow, rect: FlightRect): Promise<string> {
    const content = window.getContentBounds();
    const image = await window.webContents.capturePage(
      {
        x: Math.round(rect.x - content.x),
        y: Math.round(rect.y - content.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      },
      { stayHidden: true },
    );
    const { width, height } = image.getSize();
    const url =
      width * height > PNG_MOST_PIXELS
        ? `data:image/jpeg;base64,${image.toJPEG(90).toString("base64")}`
        : image.toDataURL();
    this.nextStill += 1;
    const id = `still-${this.nextStill}`;
    this.stills.set(id, url);
    return id;
  }

  /** Resolves once every layer has painted all it was sent. */
  async painted(): Promise<void> {
    await Promise.all(
      this.layers.map(async (layer) => {
        while (layer.sending || layer.pending.length > 0) {
          await layer.sending;
          if (layer.window.isDestroyed()) return;
        }
        if (layer.window.isDestroyed()) return;
        // Reading a pixel back waits for the compositor to have drawn the page.
        await layer.window.webContents
          .capturePage({ x: 0, y: 0, width: 1, height: 1 }, { stayHidden: true })
          .catch(() => undefined);
      }),
    );
  }

  /** The flight is over: the layers go, and their stills. */
  end(): void {
    for (const layer of this.layers) {
      if (!layer.window.isDestroyed()) layer.window.destroy();
    }
    this.layers = [];
    this.stills.clear();
  }
}
