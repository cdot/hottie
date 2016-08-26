/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

const TOP = 1;
const BOTTOM = TOP << 1;
const LEFT = BOTTOM << 1;
const RIGHT = LEFT << 1;

/**
 * Construct a new trace line
 * @param {string} name name of the trace
 * @param {string} type option trace type, may be "binary"
 * @class
 */
function Trace(graph, name, type) {
    "use strict";
    this.name = name;
    this.graph = graph;
    this.type = "continuous";
    if (typeof type === "string")
        this.type = type;
    this.points = [];
    this.colour = trace_cols.shift();
    if (this.type === "binary")
        this.slot = graph.next_slot++;
}

Trace.prototype.outCode = function(p, min, max) {
    "use strict";
    var code = 0;
    if (p.x < min.x)
	code |= LEFT;
    else if (p.x > max.x)
	code |= RIGHT;
    if (p.y < min.y)
	code |= BOTTOM;
    else if (p.y > max.y)
	code |= TOP;
    return code;
};

// Cohen-Sutherland clipping
Trace.prototype.clipLine = function(a, b, min, max) {
    "use strict";

    var ac = this.outCode(a, min, max);
    var bc = this.outCode(b, min, max);
    var cc, x, y;

    while (ac + bc !== 0) {
        if ((ac & bc) !== 0)
            // Points both outside the same side
            return true; /// line is clipped

        cc = (ac !== 0) ? ac : bc;

        if ((cc & TOP) !== 0) {
            x = a.x + (b.x - a.x) * (max.y - a.y) / (b.y - a.y);
            y = max.y;
        } else if ((cc & BOTTOM) !== 0) {
            x = a.x + (b.x - a.x) * (min.y - a.y) / (b.y - a.y);
            y = min.y;
        } else if ((cc & RIGHT) !== 0) {
            y = a.y + (b.y - a.y) * (max.x - a.x) / (b.x - a.x);
            x = max.x;
        } else if ((cc & LEFT) !== 0) {
            y = a.y + (b.y - a.y) * (min.x - a.x) / (b.x - a.x);
            x = min.x;
        }

	if (cc === ac) {
            a.x = x;
            a.y = y;
            ac = this.outCode(a, min, max);
        } else {
            b.x = x;
            b.y = y;
            bc = this.outCode(b, min, max);
        }
    }
    return false;
};

var trace_cols = [
    "red",
    "orange",
    "yellow",
    "magenta",
    "cyan",
    "green",
    "white"
];

/**
 * Add a point to the trace
 * @param {point} OR p = object `{ x:, y: }`
 */
Trace.prototype.addPoint = function(x, y) {
    "use strict";
    var p;
    if (typeof y !== "undefined")
        p = { x: x, y: y };
    else
        p = x;
    this.points.push(p);
    this.extents = null; // clear cache
};

/**
 * In-place sort the points in the data along the given axis
 * @param {string} axis x or y
 */
Trace.prototype.sortPoints = function(axis) {
    "use strict";
    this.points.sort(function(a, b) {
        if (a[axis] > b[axis])
            return 1;
        if (a[axis] < b[axis])
            return -1;
        return 0;
    });
};

/**
 * Clip the data in the trace to the given range
 * @param {number} min bottom of range
 * @param {number} max top of range
 */
Trace.prototype.clip = function(min, max) {
    "use strict";
    // TODO: do this properly. At the moment it assumes clipping
    // on the left and leaves all else unclipped.
    var lp;
    while (this.points.length > 0 && this.outCode(this.points[0], min, max) !== 0)
        lp = this.points.shift();
    if (lp && this.points.length > 0)
        this.clipLine(lp, this.points[0], min, max);
};

/**
 * Get the limits of the points in the trace
 * @return {object} {min:{x:,y:}, max:{x:,y:}}
 */
Trace.prototype.getExtents = function() {
    "use strict";
    if (this.extents)
        return this.extents;
    var e = this.extents = {
        min: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
        max: { x: Number.MIN_VALUE, y: Number.MIN_VALUE }
    };
    for (var i in this.points) {
        var p = this.points[i];
        if (p.x < e.min.x) e.min.x = p.x;
        if (p.x > e.max.x) e.max.x = p.x;
        if (p.y < e.min.y) e.min.y = p.y;
        if (p.y > e.max.y) e.max.y = p.y;
    }
    return e;
};

Trace.prototype.digitalTrace = function(sample, g) {
    var slot_height = g.$canvas.height() / 10;
    var slot_base = (this.slot + 1) * slot_height;
    return sample === 1 ? (slot_base + 1) : (slot_base + slot_height - 1);
};

/**
 * Render the trace in the given graph
 * @param {Graph} g the graph we are rendering within
 */
Trace.prototype.render = function() {
    "use strict";

    if (this.points.length < 2)
        return;

    var g = this.graph;

    g.ctx.strokeStyle = this.colour;

    // Current
    g.ctx.beginPath();
    var p, j;
    if (this.type === "binary") {
        p = {
            x: g.x2v(this.points[0].x),
            y: this.digitalTrace(this.points[0].y, g)
        };
        g.ctx.moveTo(p.x, p.y);
        for (j = 1; j < this.points.length; j++) {
            p.x = g.x2v(this.points[j].x);
            g.ctx.lineTo(p.x, p.y);
            p.y = this.digitalTrace(this.points[j].y, g);
            g.ctx.lineTo(p.x, p.y);
        }
        p.x = g.$canvas.width();
        g.ctx.lineTo(p.x, p.y);
    } else {
        p = g.l2v(this.points[0]);
        g.ctx.moveTo(p.x, p.y);
        for (j = 1; j < this.points.length; j++) {
            p = g.l2v(this.points[j]);
            g.ctx.lineTo(p.x, p.y);
        }
    }

    g.ctx.stroke();
};

/**
 * Render the label at (x, y) and return the width of the label
 * @param {Graph} g the graph we are rendering within
 * @param {number} x coordinate
 * @param {number} y coordinate
 */
Trace.prototype.renderLabel = function(g, x, y) {
    "use strict";
    g.ctx.fillStyle = this.colour;
    g.ctx.strokeStyle = this.colour;
    g.ctx.fillText(this.name, x, y);
    return g.ctx.measureText(this.name).width;
};

/**
 * Simple auto-scaling graph for a set of traces using an HTML5 canvas.
 * @param {jquery} $canvas jQuery object around canvas element
 * @param {object} options options for the graph
 * * `background_col`: colour of background
 * * `text_col`: colour of text
 * * `font_height`: height of label font
 * * `min`: Point, optional bottom/left of y axis
 * * `max`: as `min`
 * * `adjust`: {}
 *   * `max`: {}
 *     * `x`: `clip` or `scale` - how to handle an out-or-range value at
 *            this end of this axis
 *     * `y`: as `x`
 *   * `min`: as `max`
 * @class
 */
function Graph(options, $canvas) {
    "use strict";
    var self = this;

    self.$canvas = $canvas;
    self.ctx = $canvas[0].getContext("2d");

    self.options = $.extend({
        min: {},
        max: {},
        background_col: "black",
        text_col: "white",
        font_height: 10, // px
        adjust: {}
    }, options);
    self.options.min = $.extend({
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE
    }, self.options.min);
    self.options.max = $.extend({
        x: Number.MIN_VALUE,
        y: Number.MIN_VALUE
    }, self.options.max);
    self.options.adjust = $.extend({
        max: {},
        min: {}     
    }, self.options.adjust);
    // TODO: can't have clip at both ends of an axis
    self.options.adjust.min = $.extend({
            x: "clip",
            y: "scale"
    }, self.options.adjust.min);
    self.options.adjust.max = $.extend({
            x: "scale",
            y: "scale"
    }, self.options.adjust.max);

    $canvas.on("mousemove", function(e) {
        var targ;
        if (!e)
            e = window.event;
        if (e.target)
            targ = e.target;
        else if (e.srcElement)
            targ = e.srcElement;
        if (targ.nodeType === 3) // defeat Safari bug
            targ = targ.parentNode;

        var targ_left = $canvas.offset().left;
        var targ_top = $canvas.offset().top;

        // jQuery normalizes the pageX and pageY
        // pageX,Y are the mouse positions relative to the document
        var p = { x: e.pageX - targ_left, y: e.pageY - targ_top };
        var th = self.options.font_height;

        if (p.y >= th && p.y <= $canvas.height() - th) {
            var l = self.v2l(p);
            var text = options.render_label("x", l.x) + ","
                + options.render_label("y", l.y);

            var $tipCanvas = $("#tip_canvas");
            var tipCtx = $tipCanvas[0].getContext("2d");
            var tw = tipCtx.measureText(text).width;

            // CSS just stretches the content
            tipCtx.canvas.width = tw;
            tipCtx.canvas.height = th;

            tipCtx.fillStyle = self.options.background_col;
            tipCtx.fillRect(0, 0, tw, th);

            tipCtx.fillStyle = "white";
            tipCtx.strokeStyle = "white";
            tipCtx.font = th + "px sans-serif";

            // Move the tip to the left if too near right edge
            if (p.x + tw > $canvas.width())
                p.x -= tw;

            $tipCanvas.css({
                left: (p.x + targ_left) + "px",
                top: (p.y + targ_top) + "px",
                width: tw,
                height: th
            });
            tipCtx.textBaseline = "top";
            tipCtx.fillText(text, 0, 0);
            $("#tip_canvas").show();
        } else
            $("#tip_canvas").hide();           
    })
    .hover(
        function() {
            $("#tip_canvas").show();
        },
        function() {
            $("#tip_canvas").hide();
        });

    self.next_slot = 0;
    self.traces = {};
}
/**
 * Convert a logical X to a canvas coordinate
 * @param x {number} ordinate
 * @private
 */
Graph.prototype.x2v = function(x) {
    "use strict";
    var full_width = this.$canvas.width();

    return Math.floor((x - this.options.min.x) * full_width
                      / (this.options.max.x - this.options.min.x));
};

/**
 * Convert a logical X to a canvas coordinate
 * @param y {number} ordinate
 * @private
 */
Graph.prototype.y2v = function(y) {
    "use strict";
    // Allow font_height above and below the drawing area for legend
    var full_height = this.$canvas.height();
    var font_height = this.options.font_height;
    return Math.floor(full_height -
            (font_height
             + ((y - this.options.min.y)
                * (full_height - 2 * font_height)
                / (this.options.max.y - this.options.min.y))));
};

/**
 * Convert logical point on a trace to a physical point
 * @param {object} p {x:,y:} logical point (float)
 * @return {object} {x:,y:} physical point (int)
 * @private
 */
Graph.prototype.l2v = function(p) {
    "use strict";

    return {
        x: this.x2v(p.x),
        y: this.y2v(p.y)
    };
};

/**
 * Convert a canvas point to a logical point
 * @param {object} p {x:,y:} physical point (int)
 * @return {object} {x:,y:} logical point (float)
 * @private
 */
Graph.prototype.v2l = function(p) {
    "use strict";
    var full_width = this.$canvas.width();
    var full_height = this.$canvas.height();
    var font_height = this.options.font_height;

    return {
        x: this.options.min.x + 
            (this.options.max.x - this.options.min.x) * p.x / full_width,
        y: this.options.min.y + 
            (this.options.max.y - this.options.min.y)
            * (full_height - p.y - font_height)
            / (full_height - 2 * font_height)
    };
};

/**
 * Add a point to the given trace on the graph.
 * @param {string} tracename name of the trace
 * @param x {number} x ordinate
 * @param y {number} y ordinate
 */
Graph.prototype.addPoint = function(tracename, x, y) {
    "use strict";
    this.traces[tracename].addPoint(x, y);
};

/**
 * Add a trace to the graph, of the given type ("binary" or anything else for a line)
 * @return {Trace} the trace
 */
Graph.prototype.addTrace = function(tracename, type) {
    this.traces[tracename] = new Trace(this, tracename, type);
    return this.traces[tracename];
};

/**
 * Sort the points in a trace along the given axis
 * @private
 */
Graph.prototype.sortPoints = function(tracename, axis) {
    "use strict";
    if (typeof this.traces[tracename] === "undefined")
        return;
    this.traces[tracename].sortPoints(axis);
};

/**
 * Update (draw) the graph.
 */
Graph.prototype.update = function() {
    "use strict";
    var $canvas = this.$canvas;
    var options = this.options;
    var ctx = this.ctx;

    if ($canvas.height() === 0)
        return;

    // Rendering doesn't work unless you force the attrs
    if (!$canvas.data("attrs_set")) {
        $canvas.attr("width", $canvas.width());
        $canvas.attr("height", $canvas.height());
        $canvas.data("attrs_set", true);
    }

    // Always fill the background and paint the window. We may blat
    // some or all of this with the history image. We actually only
    // need to paint the rightmost pixel, but this is cheap.

    // Background
    ctx.fillStyle = options.background_col;
    ctx.fillRect(0, 0, $canvas.width(), $canvas.height());

    // Scale and clip the viewport
    var i, j, e, t, clip, a = options.adjust;
    var range = {
        x: options.max.x - options.min.x,
        y: options.max.y - options.min.y
    };
    for (i in this.traces) {
        t = this.traces[i];
        e = t.getExtents();
        clip = false;
        for (var ax in e.min) {
            // Scale first to shift the end of a clipped axis
            if (e.min[ax] < options.min[ax] && a.min[ax] === "scale")
                options.min[ax] = e.min[ax];
            if (e.max[ax] > options.max[ax] && a.max[ax] === "scale")
                options.max[ax] = e.max[ax];
            // Now apply clip, and flag a trace clip.
            if (e.min[ax] < options.min[ax] && a.min[ax] === "clip") {
                options.min[ax] = options.max[ax] - range[ax];
                clip = true;
            }
            if (e.max[ax] > options.max[ax] && a.max[ax] === "clip") {
                options.max[ax] = options.min[ax] + range[ax];
                clip = true;
            }
        }
        if (clip) {
            t.clip(options.min, options.max);
        }
    }
    
    // Paint the traces
    for (i in this.traces) {
//        if (typeof options.sort_axis[i] !== "undefined")
//           this.traces[i].sortPoints(options.sort_axis[i]);
        this.traces[i].render();
    }

    // Legends
    ctx.fillStyle = options.text_col;
    ctx.strokeStyle = options.text_col;
    ctx.font = options.font_height + "px sans-serif";

    var labels = { min: {}, max: {} };

    for (i in { max: 0, min: 1 }) {
        for (j in { x: 0, y: 1 }) {
            if (options.render_label)
                labels[i][j] = options.render_label(j, options[i][j]);
            else
                labels[i][j] = "" + options[i][j].toPrecision(4);
        }
    }

    ctx.textBaseline = "top";
    ctx.fillText(labels.max.y, 0, 0);
    ctx.fillText(labels.min.x, ctx.measureText(labels.max.y).width + 20, 0);
    ctx.fillText(labels.max.x,
                 $canvas.width() - ctx.measureText(labels.max.x).width - 10, 0);

    ctx.textBaseline = "bottom";
    ctx.fillText(labels.min.y, 0, $canvas.height());

    var x = ctx.measureText(t).width + 20;
    for (i in this.traces) {
        x += this.traces[i].renderLabel(this, x, $canvas.height()) + 15;
    }
};

(function($) {
    "use strict";

    $.fn.autoscale_graph = function(options) {
        var $canvas = $(this);

        $(this).data("graph", new Graph(options, $canvas));
    };
})(jQuery);
