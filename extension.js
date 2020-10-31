/*
 * battery-status@atareao.es
 *
 * Copyright (c) 2020 Lorenzo Carbonell Cerezo <a.k.a. atareao>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

imports.gi.versions.Gtk = "3.0";
imports.gi.versions.Gdk = "3.0";
imports.gi.versions.Gio = "2.0";
imports.gi.versions.Clutter = "1.0";
imports.gi.versions.St = "1.0";
imports.gi.versions.GObject = "3.0";
imports.gi.versions.GLib = "2.0";

const {Gtk, Gdk, Gio, Clutter, St, GObject, GLib, Pango, PangoCairo} = imports.gi;
const Cairo = imports.cairo;

const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;
const PieChart = Extension.imports.piechart.PieChart;

const Gettext = imports.gettext.domain(Extension.uuid);
const _ = Gettext.gettext;

var button;


function notify(msg, details, icon='battery-status-icon') {
    let source = new MessageTray.Source(Extension.uuid, icon);
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details);
    notification.setTransient(true);
    source.notify(notification);
}

var BatteryStatus = GObject.registerClass(
    class BatteryStatus extends PanelMenu.Button{
        _init(){
            super._init(St.Align.START);
            this._settings = Convenience.getSettings();
            this._loadPreferences();

            /* Icon indicator */
            Gtk.IconTheme.get_default().append_search_path(
                Extension.dir.get_child('icons').get_path());

            let box = new St.BoxLayout();
            this.icon = new St.Icon({style_class: 'system-status-icon'});
            box.add(this.icon);
            this._timeLeft = new St.Label({text: 'Button',
                                           y_expand: true,
                                           y_align: Clutter.ActorAlign.CENTER });
            box.add(this._timeLeft);
            //box.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
            this.actor.add_child(box);
            /* Start Menu */
            let itemBatteryCharge = this._getBatteryChargeMenuItem();
            this.menu.addMenuItem(itemBatteryCharge);
            
            let itemBatteryHealth = this._getBatteryHealthMenuItem();
            this.menu.addMenuItem(itemBatteryHealth);

            /* Separator */
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            /* Setings */
            this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
            this.settingsMenuItem.connect('activate', () => {
                ExtensionUtils.openPrefs();
            });
            this.menu.addMenuItem(this.settingsMenuItem);
            /* Help */
            this.menu.addMenuItem(this._get_help());
            /* Init */
            this._update();
            this._sourceId = 0;
            this._settingsChanged();
            this._settings.connect('changed',
                                   this._settingsChanged.bind(this));
        }

        _loadPreferences(){
            this._path = this._getValue('path');
            this._checktime = this._getValue('checktime');
            this._darktheme = this._getValue('darktheme');
            this._normalColor = this._getValue('normal-color');
            this._warning = this._getValue('warning');
            this._warningColor = this._getValue('warning-color');
            this._danger = this._getValue('danger');
            this._dangerColor = this._getValue('danger-color');
        }

        _getRow(label, value){
            let row = new St.BoxLayout();
            row.add_actor(new St.Label({
                text: label,
                style_class: 'battery-label'
            }));
            row.add_actor(value);
            return row;
        }

        _getBatteryHealthMenuItem(){
            let itemBatteryHealth = new PopupMenu.PopupBaseMenuItem({
                reactive: false
            });
            let batteryHealthBox = new St.BoxLayout({
                vertical: true
            });
            itemBatteryHealth.add_actor(batteryHealthBox);
            batteryHealthBox.add_actor(new St.Label({
                                text: _('Battery health')
            }));
           let batteryHealthInnerBox = new St.BoxLayout({
                                vertical: true,
                                style_class: 'message battery-box'
                            });
            batteryHealthBox.add_actor(batteryHealthInnerBox);
            this._currentMax = new St.Label({
                text: '5162 mAh',
               x_expand: true,
               x_align: Clutter.ActorAlign.END });
            batteryHealthInnerBox.add_actor(this._getRow(
                _('Current max:'),
                this._currentMax
            ));
            this._originalMax = new St.Label({
                text: '5770 mAh',
               x_expand: true,
               x_align: Clutter.ActorAlign.END });
            batteryHealthInnerBox.add_actor(this._getRow(
                _('Original max:'),
                this._originalMax
            ));
            let cc = new St.BoxLayout({
                                x_align: Clutter.ActorAlign.CENTER,
                                y_align: Clutter.ActorAlign.CENTER,
                            });
            batteryHealthInnerBox.add_actor(cc);
            this._batteryHealthPie = new PieChart(70, 70, 30, this._warning,
                this._danger, this._normalColor, this._warningColor,
                this._dangerColor);
            cc.add_actor(this._batteryHealthPie);
            this._voltageNow = new St.Label({
                text: '7,498 V',
               x_expand: true,
               x_align: Clutter.ActorAlign.END });
            batteryHealthInnerBox.add_actor(this._getRow(
                _('Voltage now:'),
                this._voltageNow
            ));
            this._originalVoltage = new St.Label({
                text: '7,640 V',
               x_expand: true,
               x_align: Clutter.ActorAlign.END });
            batteryHealthInnerBox.add_actor(this._getRow(
                _('Original voltage:'),
                this._originalVoltage
            ));
            return itemBatteryHealth;
        }


        _getBatteryChargeMenuItem(){
            let itemBatteryCharge = new PopupMenu.PopupBaseMenuItem({
                reactive: false
            });
            let batteryCharge = new St.BoxLayout({
                vertical:true
            });
            itemBatteryCharge.actor.add_actor(batteryCharge);
            batteryCharge.add_actor(new St.Label({
                                text: _('Battery charge')
            }));
            /* */
            let batteryChargeInner = new St.BoxLayout({
                                vertical: true,
                                style_class: 'message battery-box'
                            });
            batteryCharge.add_actor(batteryChargeInner);
            let batteryChargeInnerInfo= new St.BoxLayout();
            batteryChargeInner.add_actor(batteryChargeInnerInfo);
            this._currentCharge = new St.Label({
                text: '4159 mAh',
               x_expand: true,
               x_align: Clutter.ActorAlign.END });
            batteryChargeInner.add_actor(this._getRow(
                _('Current charge:'),
                this._currentCharge
            ));
            let cc = new St.BoxLayout({
                                x_align: Clutter.ActorAlign.CENTER,
                                y_align: Clutter.ActorAlign.CENTER,
                            });
            batteryChargeInner.add_actor(cc);
            this._currentChargePie = new PieChart(70, 70, 30, this._warning,
                this._danger, this._normalColor, this._warningColor,
                this._dangerColor);
            cc.add_actor(this._currentChargePie);

            let dd = new St.BoxLayout({
                                x_align: Clutter.ActorAlign.CENTER,
                                y_align: Clutter.ActorAlign.CENTER,
                            });
            batteryChargeInner.add_actor(dd);
            this._teoricalChargePie = new PieChart(70, 70, 30, this._warning,
                this._danger, this._normalColor, this._warningColor,
                this._dangerColor);
            cc.add_actor(this._teoricalChargePie);

            return itemBatteryCharge;
        }

        _getValue(keyName){
            this._settings = Convenience.getSettings();
            return this._settings.get_value(keyName).deep_unpack();
        }

        _update(){
            if(!this._path.endsWith('/')){
                this._path = this._path + '/';
            }
            try {
                let file = Gio.File.new_for_path(this._path + 'uevent');
                if(file.query_exists(null)){
                    file.load_contents_async(null, (source_object, res) => {
                        try{
                            res = source_object.load_contents_finish(res);
                            let [ok, contents, etag_out] = res;
                            contents = String.fromCharCode.apply(null, contents);
                            let discharging = contents.match(/POWER_SUPPLY_STATUS=Discharging/);
                            let power_supply_voltage_min_design = contents.match(/POWER_SUPPLY_VOLTAGE_MIN_DESIGN=\d*/);
                            if(power_supply_voltage_min_design != null){
                                power_supply_voltage_min_design = power_supply_voltage_min_design.toString().substring(32);
                            }
                            let power_supply_voltage_now = contents.match(/POWER_SUPPLY_VOLTAGE_NOW=\d*/);
                            if(power_supply_voltage_now != null){
                                power_supply_voltage_now = power_supply_voltage_now.toString().substring(25);
                            }
                            let power_supply_current_now = contents.match(/POWER_SUPPLY_CURRENT_NOW=\d*/);
                            if(power_supply_current_now != null){
                                power_supply_current_now = power_supply_current_now.toString().substring(25);
                            }
                            let power_supply_charge_full_design = contents.match(/POWER_SUPPLY_CHARGE_FULL_DESIGN=\d*/);
                            if(power_supply_charge_full_design != null){
                                power_supply_charge_full_design = power_supply_charge_full_design.toString().substring(32);
                            }
                            let power_supply_charge_full = contents.match(/POWER_SUPPLY_CHARGE_FULL=\d*/);
                            if(power_supply_charge_full != null){
                                power_supply_charge_full = power_supply_charge_full.toString().substring(25);
                            }
                            let power_supply_charge_now = contents.match(/POWER_SUPPLY_CHARGE_NOW=\d*/);
                            if(power_supply_charge_now != null){
                                power_supply_charge_now = power_supply_charge_now.toString().substring(24);
                            }
                            let power_supply_capacity = contents.match(/POWER_SUPPLY_CAPACITY=\d*/);
                            if(power_supply_capacity != null){
                                power_supply_capacity = power_supply_capacity.toString().substring(22);
                            }
                            this._set_icon_indicator(discharging != null);
                            let voltageDesign = parseFloat(power_supply_voltage_min_design) / 1000 / 1000;
                            this._originalVoltage.set_text(voltageDesign.toString() + ' ' + _('V'));
                            let voltageNow = parseFloat(power_supply_voltage_now) / 1000 /1000;
                            this._voltageNow.set_text(voltageNow.toString() + ' ' + _('V'));
                            if(power_supply_charge_full != null){
                                let currentMax = parseFloat(power_supply_charge_full) / 1000;
                                this._currentMax.set_text(currentMax.toString() + ' ' + _('mAh'));
                            }
                            if(power_supply_charge_full_design != null){
                                let originalMax = parseFloat(power_supply_charge_full_design) / 1000;
                                this._originalMax.set_text(originalMax.toString() + ' ' + _('mAh'));
                            }
                            if(power_supply_charge_now != null){
                                let currentCharge = parseFloat(power_supply_charge_now) / 1000;
                                this._currentCharge.set_text(currentCharge.toString() + ' ' + _('mAh'));
                            }
                            if(power_supply_charge_full != null && power_supply_charge_full_design != null){
                                let currentMax = parseFloat(power_supply_charge_full) / 1000;
                                let originalMax = parseFloat(power_supply_charge_full_design) / 1000;
                                this._batteryHealthPie.setPercentage(Math.round(currentMax / originalMax * 100));
                                this._batteryHealthPie.redraw()
                            }
                            if(power_supply_charge_full != null && power_supply_charge_now != null){
                                let currentMax = parseFloat(power_supply_charge_full) / 1000.0;
                                let currentCharge = parseFloat(power_supply_charge_now) / 1000.0;
                                this._currentChargePie.setPercentage(Math.round(currentCharge / currentMax * 100));
                                this._currentChargePie.redraw()
                            }
                            if(power_supply_charge_full_design != null && power_supply_charge_now != null){
                                let currentMax = parseFloat(power_supply_charge_full_design) / 1000.0;
                                let currentCharge = parseFloat(power_supply_charge_now) / 1000.0;
                                this._teoricalChargePie.setPercentage(Math.round(currentCharge / currentMax * 100));
                                this._teoricalChargePie.redraw()
                            }
                            if(power_supply_current_now != null && power_supply_charge_now != null){
                                let currentNow = parseFloat(power_supply_current_now) / 1000.0;
                                if(parseInt(currentNow) > 1){
                                    let chargeNow = parseFloat(power_supply_charge_now) / 1000.0;
                                    let timeleft = chargeNow / currentNow
                                    let hours = parseInt(timeleft);
                                    let minutes = parseInt((timeleft - hours)*60);
                                    if(minutes >= 60){
                                        hours = hours + 1;
                                        minutes = 0;
                                    }
                                    hours = hours.toString();
                                    if(hours.length < 2){
                                        hours = '0'.repeat(2 - hours.length) + hours;
                                    }
                                    minutes = minutes.toString();
                                    if(minutes.length <  2){
                                        minutes = '0'.repeat(2 - minutes.length) + minutes;
                                    }
                                    this._timeLeft.set_text(hours + ':' + minutes);
                                }else{
                                    this._timeLeft.set_text('');
                                }
                            }
                        }catch(e){
                            logError(e);
                        }
                    });
                }
            } catch (e) {
                logError(e);
            }
            return true;
        }
        _set_icon_indicator(active){
            let theme_string = (this._darktheme?'dark': 'light');
            let status_string = (active ? 'active' : 'paused');
            let icon_string = 'battery-status-' + status_string + '-' + theme_string;
            this.icon.set_gicon(this._get_icon(icon_string));
        }
        _get_icon(icon_name){
            let base_icon = Extension.path + '/icons/' + icon_name;
            let file_icon = Gio.File.new_for_path(base_icon + '.png')
            if(file_icon.query_exists(null) == false){
                file_icon = Gio.File.new_for_path(base_icon + '.svg')
            }
            if(file_icon.query_exists(null) == false){
                return null;
            }
            let icon = Gio.icon_new_for_string(file_icon.get_path());
            return icon;
        }

        _create_help_menu_item(text, icon_name, url){
            let icon = this._get_icon(icon_name);
            let menu_item = new PopupMenu.PopupImageMenuItem(text, icon);
            menu_item.connect('activate', () => {
                Gio.app_info_launch_default_for_uri(url, null);
            });
            return menu_item;
        }
        _createActionButton(iconName, accessibleName){
            let icon = new St.Button({ reactive:true,
                                       can_focus: true,
                                       track_hover: true,
                                       accessible_name: accessibleName,
                                       style_class: 'system-menu-action'});
            icon.child = new St.Icon({icon_name: iconName });
            return icon;
        }

        _get_help(){
            let menu_help = new PopupMenu.PopupSubMenuMenuItem(_('Help'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Project Page'), 'info', 'https://github.com/atareao/battery-status/'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Get help online...'), 'help', 'https://www.atareao.es/aplicacion/battery-status/'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Report a bug...'), 'bug', 'https://github.com/atareao/battery-status/issues'));

            menu_help.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('El atareao'), 'atareao', 'https://www.atareao.es'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('GitHub'), 'github', 'https://github.com/atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Twitter'), 'twitter', 'https://twitter.com/atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Telegram'), 'telegram', 'https://t.me/canal_atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Mastodon'), 'mastodon', 'https://mastodon.social/@atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Spotify'), 'spotify', 'https://open.spotify.com/show/2v0fC8PyeeUTQDD67I0mKW'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('YouTube'), 'youtube', 'http://youtube.com/c/atareao'));
            return menu_help;
        }
        _settingsChanged(){
            this._loadPreferences();

            this._batteryHealthPie.setNormalColor(this._normalColor);
            this._batteryHealthPie.setWarningColor(this._warningColor);
            this._batteryHealthPie.setDangerColor(this._dangerColor);
            this._batteryHealthPie.setWarning(this._warning);
            this._batteryHealthPie.setDanger(this._danger);
            this._batteryHealthPie.redraw();

            this._currentChargePie.setNormalColor(this._normalColor);
            this._currentChargePie.setWarningColor(this._warningColor);
            this._currentChargePie.setDangerColor(this._dangerColor);
            this._currentChargePie.setWarning(this._warning);
            this._currentChargePie.setDanger(this._danger);
            this._currentChargePie.redraw();

            this._teoricalChargePie.setNormalColor(this._normalColor);
            this._teoricalChargePie.setWarningColor(this._warningColor);
            this._teoricalChargePie.setDangerColor(this._dangerColor);
            this._teoricalChargePie.setWarning(this._warning);
            this._teoricalChargePie.setDanger(this._danger);
            this._teoricalChargePie.redraw();

            this._update();

            if(this._sourceId > 0){
                GLib.source_remove(this._sourceId);
            }
            this._sourceId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, this._checktime,
                this._update.bind(this));
        }

        disableUpdate(){
            if(this._sourceId > 0){
                GLib.source_remove(this._sourceId);
            }
        }
    }
);

let batteryStatus;

function init(){
    Convenience.initTranslations();
}

function enable(){
    batteryStatus = new BatteryStatus();
    Main.panel.addToStatusArea('batteryStatus', batteryStatus, 0, 'right');
}

function disable() {
    batteryStatus.disableUpdate();
    batteryStatus.destroy();
}
