type TOffset = {
    x: number;
    y: number;
}

type TRect = {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type TPagemapOptions = {
    viewport?: HTMLElement | null,
    styles?: {
        [k: string]: string;
    },
    back?: string;
    view?: string;
    drag?: string;
    interval?: number | null;
}

export class Pagemap {
    private _ctx: CanvasRenderingContext2D;
    private _appliedOptions: TPagemapOptions;

    private _drag: boolean = false;

    private _root_rect: TRect;
    private _view_rect: TRect;
    private _scale: number;
    private _drag_rx: number;
    private _drag_ry: number;

    private _defaultOptions: TPagemapOptions = {
        viewport: null,
        styles: {
            'header,footer,section,article': '#00000008',
            'h1,a': '#0000000a',
            'h2,h3,h4': '#00000008',
        },
        back: '#00000002',
        view: '#00000005',
        drag: '#0000000a',
        interval: null,
    };

    constructor(
        private readonly _canvas: HTMLCanvasElement,
        opts: TPagemapOptions,
    ) {
        this._ctx = _canvas.getContext('2d');

        this._appliedOptions = Object.assign(
            {},
            this._defaultOptions,
            opts,
        );

        this._init();
    }

    private static _rect_rel_to(
        rect: TRect,
        pos = { x: 0, y: 0 },
    ) {
        return {
            x: rect.x - pos.x,
            y: rect.y - pos.y,
            width: rect.width,
            height: rect.height,
        };
    };

    private static _rect_of_doc(): TRect {
        return {
            x: 0,
            y: 0,
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
        };
    };

    private static _rect_of_win(): TRect {
        return {
            x: window.pageXOffset,
            y: window.pageYOffset,
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
        };
    };

    private static _node_get_offset(node: HTMLElement): TOffset {
        const boundingRect = node.getBoundingClientRect();

        return {
            x: boundingRect.left + window.pageXOffset,
            y: boundingRect.top + window.pageYOffset,
        };
    };

    private static _rect_of_node(node: HTMLElement): TRect {
        const nodeOffset = Pagemap._node_get_offset(node);

        return {
            x: nodeOffset.x,
            y: nodeOffset.y,
            width: node.offsetWidth,
            height: node.offsetHeight,
        };
    };

    private static _rect_of_viewport(node: HTMLElement) {
        const nodeOffset = Pagemap._node_get_offset(node);

        return {
            x: nodeOffset.x + node.clientLeft,
            y: nodeOffset.y + node.clientTop,
            width: node.clientWidth,
            height: node.clientHeight,
        };
    };

    private static _rect_of_content(node: HTMLElement) {
        const nodeOffset = Pagemap._node_get_offset(node);

        return {
            x: nodeOffset.x + node.clientLeft - node.scrollLeft,
            y: nodeOffset.y + node.clientTop - node.scrollTop,
            width: node.scrollWidth,
            height: node.scrollHeight,
        };
    };

    private _get_scaled(
        width: number,
        height: number,
    ) {
        return Math.min(
            this._canvas.clientWidth / width,
            this._canvas.clientHeight / height,
        );
    }

    private _resize_canvas(
        width: number,
        height: number,
    ) {
        this._canvas.width = width;
        this._canvas.height = height;
        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    }

    private _findInViewport(sel: string): HTMLElement[] {
        return [].slice.call((this._appliedOptions.viewport || document).querySelectorAll(sel));
    }

    private _draw_rect(
        rect: TRect,
        fillStyle: string,
    ) {
        if (!fillStyle) {
            return;
        }

        this._ctx.beginPath();
        this._ctx.rect(rect.x, rect.y, rect.width, rect.height);
        this._ctx.fillStyle = fillStyle;
        this._ctx.fill();
    }

    private _apply_styles(styles: TPagemapOptions['styles']) {
        for (const sel of Object.keys(styles)) {
            const fillStyle = styles[sel];

            for (const node of this._findInViewport(sel)) {
                this._draw_rect(
                    Pagemap._rect_rel_to(
                        Pagemap._rect_of_node(node),
                        this._root_rect,
                    ),
                    fillStyle,
                );
            }
        }
    };

    private _draw = () => {
        this._root_rect =
            this._appliedOptions.viewport
                ? Pagemap._rect_of_content(
                    this._appliedOptions.viewport,
                )
                : Pagemap._rect_of_doc();

        this._view_rect =
            this._appliedOptions.viewport
                ? Pagemap._rect_of_viewport(
                    this._appliedOptions.viewport,
                )
                : Pagemap._rect_of_win();

        this._scale = this._get_scaled(
            this._root_rect.width,
            this._root_rect.height,
        );

        this._resize_canvas(
            this._root_rect.width * this._scale,
            this._root_rect.height * this._scale,
        );

        this._ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0,
        );

        this._ctx.clearRect(
            0,
            0,
            this._canvas.width,
            this._canvas.height,
        );

        this._ctx.scale(
            this._scale,
            this._scale,
        );

        this._draw_rect(
            Pagemap._rect_rel_to(
                this._root_rect,
                this._root_rect,
            ),
            this._appliedOptions.back,
        );

        this._apply_styles(this._appliedOptions.styles);

        this._draw_rect(
            Pagemap._rect_rel_to(
                this._view_rect,
                this._root_rect,
            ),
            this._drag
                ? this._appliedOptions.drag
                : this._appliedOptions.view,
        );
    };

    private _on_drag = (event: MouseEvent) => {
        event.preventDefault();

        const cr = Pagemap._rect_of_viewport(this._canvas);
        const x = (event.pageX - cr.x) / this._scale - this._view_rect.width * this._drag_rx;
        const y = (event.pageY - cr.y) / this._scale - this._view_rect.height * this._drag_ry;

        if (this._appliedOptions.viewport) {
            this._appliedOptions.viewport.scrollLeft = x;
            this._appliedOptions.viewport.scrollTop = y;
        } else {
            window.scrollTo(x, y);
        }

        this._draw();
    };

    private _on_drag_end = (event: MouseEvent) => {
        this._drag = false;

        this._canvas.style.cursor = 'pointer';
        document.body.style.cursor = 'auto';

        window.removeEventListener('mousemove', this._on_drag);
        window.removeEventListener('mouseup', this._on_drag_end);

        this._on_drag(event);
    };

    private _on_drag_start = (event: MouseEvent) => {
        this._drag = true;

        const cr = Pagemap._rect_of_viewport(this._canvas);
        const vr = Pagemap._rect_rel_to(
            this._view_rect,
            this._root_rect,
        );

        this._drag_rx = ((event.pageX - cr.x) / this._scale - vr.x) / vr.width;
        this._drag_ry = ((event.pageY - cr.y) / this._scale - vr.y) / vr.height;

        if (
            this._drag_rx < 0
            || this._drag_rx > 1
            || this._drag_ry < 0
            || this._drag_ry > 1
        ) {
            this._drag_rx = 0.5;
            this._drag_ry = 0.5;
        }

        this._canvas.style.cursor = 'crosshair';
        document.body.style.cursor = 'crosshair';

        window.addEventListener('mousemove', this._on_drag);
        window.addEventListener('mouseup', this._on_drag_end);

        this._on_drag(event);
    };

    private _init() {
        this._canvas.style.cursor = 'pointer';

        this._canvas.addEventListener('mousemove', this._on_drag_start);

        const targetNode = this._appliedOptions.viewport || window;

        targetNode.addEventListener('load', this._draw);
        targetNode.addEventListener('resize', this._draw);
        targetNode.addEventListener('scroll', this._draw);

        if (this._appliedOptions.interval > 0) {
            setInterval(
                () => this._draw(),
                this._appliedOptions.interval,
            );
        }

        this._draw();
    }

    public redraw() {
        this._draw();
    }
}

((init) => {
    document.readyState === 'complete'
        ? init()
        : window.addEventListener('load', init);
})(() => {
    try {
        const pm = document.createElement('canvas');

        pm.style.position = 'sticky';
        pm.style.width = '200px';
        pm.style.bottom = '20px';
        pm.style.left = '20px';
        pm.style.height = '200px';
        pm.style.zIndex = '200';

        document.body.appendChild(pm);

        new Pagemap(pm, {
            viewport: null,
            styles: {
                'header,footer,section,article': 'rgba(0,0,0,0.15)',
                'h1,a': 'rgba(0,0,0,0.2)',
                'h2,h3,h4': 'rgba(0,0,0,0.08)',
            },
            back: 'rgba(0,0,0,0.05)',
            view: 'rgba(0,0,0,0.10)',
            drag: 'rgba(0,0,0,0.15)',
            interval: null,
        });
    } catch (err) {

    }
});
