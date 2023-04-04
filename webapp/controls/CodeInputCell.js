sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";
  var E = Control.extend("com.sedef.hcm.ux.mypaystubs.controls.CodeInputCell", {
    metadata: {
      properties: {
        pin: {
          type: "int",
          bindable: false,
        },
        tabIndex: {
          type: "int",
          bindable: true,
        },
      },
      events: {
        change: {
          parameters: {
            value: { type: "int" },
            tabIndex: { type: "int" },
          },
        },
        previous: {
          parameters: {
            tabIndex: { type: "int" },
          },
        },
      },
    },

    /**
     * @override
     */
    init: function () {
      this._initialRender = false;
    },
    /**
     * @override
     */
    onAfterRendering: function () {
      var oControl = this.$();
      var that = this;

      if (!this._initialRender) {
        this._initialRender = true;
        if (this.getTabIndex() === 0) {
          this.$().focus();
        }
      }

      oControl.bind("keydown", function (e) {
        e.preventDefault();
        try {
          if (e.key === "Backspace") {
            var prevVal = oControl.val();
            if (prevVal !== "" && prevVal !== null && prevVal !== undefined) {
              that.setProperty("pin", null, true);
              oControl.val(null);
              that.fireEvent("change", {
                tabIndex: that.getTabIndex(),
                value: null,
              });
            } else {
              oControl.val(null);
              that.setProperty("pin", null, true);
              that.fireEvent("previous", {
                tabIndex: that.getTabIndex(),
              });
            }
            return;
          }

          var enteredValue = parseInt(e.key, 10);
          if (enteredValue >= 0 && enteredValue <= 9) {
            that.setProperty("pin", enteredValue, true);
            oControl.val(enteredValue);
            that.fireEvent("change", {
              value: enteredValue,
              tabIndex: that.getTabIndex(),
            });
          }
        } catch (error) {
          oControl.val(null);
          that.setPin(null);
        }
      });
    },
    renderer: function (oRM, oControl) {
      var i = oControl.getTabIndex();
      var pin = oControl.getPin();
      try {
        oRM.openStart("input");
        oRM.writeControlData(oControl);
        oRM.attr("type", "tel");
        oRM.attr("name", "pincode-" + i);
        oRM.attr("maxlength", "1");
        oRM.attr("pattern", "[\\d]*");
        oRM.attr("tabindex", i + 1);
        oRM.attr("placeholder", "·");
        oRM.attr("autocomplete", "off");
        if (pin) {
          oRM.attr("value", pin);
        }
        oRM.class("smod-code-input-cell");
        oRM.openEnd();
        oRM.close("input");
      } catch (ex) {
        jQuery.sap.log.info("render failed!");
      }
    },
  });

  return E;
});
