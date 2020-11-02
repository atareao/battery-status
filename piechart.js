#!/usr/bin/env gjs

imports.gi.versions.GObject = "3.0";
imports.gi.versions.Clutter = "1.0";
imports.gi.versions.St = "1.0";

const {GObject, Clutter, St, Pango, PangoCairo} = imports.gi;
const Cairo = imports.cairo;

var PieChart = GObject.registerClass(
    class PieChart extends Clutter.Actor{
        _init(width, height, percentage, warning=30, danger=10,
              normalColor='#00FF00', warningColor='#FFFF00',
              dangerColor='#FF0000'){
            super._init();
            this._width = width;
            this._height = height;
            this._percentage = percentage;
            this._warning = warning;
            this._danger = danger;
            this.setNormalColor(normalColor);
            this.setWarningColor(warningColor)
            this.setDangerColor(dangerColor)
            this._canvas = new Clutter.Canvas();
            this._canvas.set_size(width, height);
            this._canvas.connect('draw', (canvas, cr, width, height)=>{
                this._draw(canvas, cr, width, height);
            });
            this.redraw();
            this.set_content(this._canvas);
            this.set_size(width, height);
        }

        setWidth(width){
            this._width = width;
        }
        setHeight(height){
            this._height = height;
        }

        setPercentage(percentage){
            this._percentage = percentage;
        }
        getPercentage(){
            return this._percentage;
        }

        setWarning(warning){
            this._warning = warning;
        }

        setDanger(danger){
            this._danger = danger;
        }

        setNormalColor(normalColor){
            this._normalColor = Clutter.Color.from_string(normalColor)[1];
        }

        setWarningColor(warningColor){
            this._warningColor = Clutter.Color.from_string(warningColor)[1];
        }

        setDangerColor(dangerColor){
            this._dangerColor = Clutter.Color.from_string(dangerColor)[1];
        }

        redraw(){
            this._canvas.invalidate();
        }

        _draw(canvas, cr, width, height){
            // Clear the canvas
            cr.save();
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.restore();
            cr.setOperator(Cairo.Operator.OVER);
            let linew = width * 0.15;
            // Begin to paint
            cr.save();
            cr.setLineWidth(linew);
            Clutter.cairo_set_source_color(cr, new Clutter.Color({
                red: 60, 
                blue: 60,
                green: 60,
                alpha: 255
            }));
            cr.arc((width) / 2,
                   (height) / 2,
                   parseInt((width - linew) / 2 * 0.8),
                   0, 2 * Math.PI)
            cr.stroke();
            cr.restore();
            cr.save();
            cr.setLineWidth(linew);
            if(this._percentage < this._danger){
                Clutter.cairo_set_source_color(cr, this._dangerColor);
            }else if(this._percentage < this._warning){
                Clutter.cairo_set_source_color(cr, this._warningColor);
            }else{
                Clutter.cairo_set_source_color(cr, this._normalColor);
            }
            cr.arc((width) / 2,
                   (height) / 2,
                   parseInt((width - linew) / 2 * 0.8),
                   Math.PI * 2* (1 - this._percentage / 100), 0);
            cr.stroke();
            cr.restore();

            cr.save();
            Clutter.cairo_set_source_color(
                cr,
                new Clutter.Color({
                red: 255, 
                blue: 255,
                green: 255,
                alpha: 255
                }));
            let texttoshow = this._percentage.toString() + "%";
            this._write_centered_text(cr, width/2, height/2, texttoshow,
                                      'Ubuntu', '10');
            cr.restore();
            cr.$dispose();
        }

        _write_centered_text(cr, x, y, text, font, size){
            let pg_layout = PangoCairo.create_layout(cr);
            let pg_context = pg_layout.get_context();
            pg_layout.set_font_description(
                Pango.FontDescription.from_string('%s %s'.format(font, size)));
            pg_layout.set_text(text, -1);

            PangoCairo.update_layout(cr, pg_layout);
            let text_size = pg_layout.get_pixel_size();

            cr.moveTo(x - text_size[0]/2, y + text_size[1]/4);
            cr.setFontSize(size);
            cr.showText(text);
        }
    }
);
