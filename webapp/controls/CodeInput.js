sap.ui.define(
  ["sap/ui/core/Control", "./CodeInputCell", "sap/m/Button"],
  function (Control, CodeInputCell, Button) {
    "use strict";
    var E = Control.extend("com.sedef.hcm.ux.mypaystubs.controls.CodeInput", {
      metadata: {
        properties: {
          digits: {
            type: "int",
            bindable: true,
            defaultValue: 4,
          },
          buttonText: {
            type: "string",
            bindable: true,
          },
          value: {
            type: "object",
            bindable: false,
          },
          isValid: {
            type: "boolean",
            bindable: false,
          },
        },
        aggregations: {
          cells: {
            type: "com.sedef.hcm.ux.mypaystubs.controls.CodeInputCell",
            multiple: true,
            singularName: "cell",
          },
          submitButton: {
            type: "sap.m.Button",
            multiple: false,
          },
        },
        events: {
          verifyPressed: {
            parameters: {
              value: { type: "string" },
            },
          },
        },
      },

      init: function () {
        //initialisation code, in this case, ensure css is imported
        var sLibraryPath = jQuery.sap.getModulePath(
          "com.sedef.hcm.ux.mypaystubs"
        ); //get the server location of the ui library
        jQuery.sap.includeStyleSheet(sLibraryPath + "/controls/CodeInput.css");

        this.setValue([]);

        this.setAggregation(
          "submitButton",
          new Button({
            text: "Submit",
            press: this.handleSubmit.bind(this),
            enabled: false,
            type: "Emphasized",
          }).addStyleClass(
            "sapUiTinyMarginTopBottom smod-code-input-validate-button"
          )
        );
      },

      renderer: function (oRM, oControl) {
        var digits = parseInt(oControl.getDigits(), 10);
        var oButton = oControl.getAggregation("submitButton");

        //--Set Button Text
        oButton.setText(oControl.getButtonText());

        oControl.destroyAggregation("cells");

        try {
          for (var i = 0; i < digits; i++) {
            var oCell = new CodeInputCell({
              tabIndex: i,
              change: oControl.handleDigitChanged.bind(oControl),
              previous: oControl.handleDigitPrevious.bind(oControl),
            });
            oControl.addAggregation("cells", oCell);
          }

          //Main content begin
          oRM.openStart("div");
          oRM.writeControlData(oControl);
          oRM.class("smod-code-input-container");

          oRM.openEnd();

          //Form
          oRM.openStart("div");
          oRM.class("smod-code-input-form");
          oRM.openEnd();

          $.each(oControl.getCells(), function (i, oCell) {
            oRM.renderControl(oCell);
          });

          oRM.close("div");
          oRM.renderControl(oButton);
          //Form end

          oRM.close("div");
          //Main content end
        } catch (ex) {
          jQuery.sap.log.info("render failed!");
        }
      },

      handleDigitChanged: function (oEvent) {
        var tabIndex = oEvent.getParameter("tabIndex");
        var pinValue = oEvent.getParameter("value");

        var oNextCell = this.getCells()[tabIndex + 1];

        if (pinValue !== null && pinValue !== undefined) {
          if (oNextCell) {
            oNextCell.$()[0].setSelectionRange(1, 1);
            oNextCell.$().focus();
          }
        }

        this.reevaluateState();
      },
      handleDigitPrevious: function (oEvent) {
        var tabIndex = oEvent.getParameter("tabIndex");
        var oPrevCell = this.getCells()[tabIndex - 1];
        if (oPrevCell) {
          oPrevCell.$()[0].setSelectionRange(1, 1);
          oPrevCell.$().focus();
        }
        this.reevaluateState();
      },
      reevaluateState: function () {
        var aCells = this.getCells();
        var aValue = [];
        var isValid = true;
        $.each(aCells, function (i, oCell) {
          var iPin = oCell.getPin();
          aValue[i] = iPin;
          if (isNaN(oCell.getPin())) {
            isValid = false;
          }
        });

        if (aValue.length !== this.getDigits()) {
          isValid = false;
        }

        this.setProperty("value", aValue, true);
        this.setProperty("isValid", isValid, true);

        if (isValid) {
          var that = this;
          setTimeout(function () {
            that.getCells()[that.getDigits() - 1].$().blur();
            that.getAggregation("submitButton").$().focus();
          }, 100);

          this.$().find(".smod-code-input-form").addClass("success");
        } else {
          this.$().find(".smod-code-input-form").removeClass("success");
        }

        this.getAggregation("submitButton").setEnabled(isValid);
      },

      invalidateCells: function () {
        this.destroyAggregation("cells");
      },
      handleSubmit: function () {
        var pin = "";

        $.each(this.getValue(), function (i, v) {
          pin = pin + v.toString();
        });
        pin.trim();
        this.fireEvent("verifyPressed", {
          value: pin,
        });
        //console.log(pin);
        //alert(`Code is ${this.getValue()}`);
      },
      onkeydown: function (oEvent) {
        if (oEvent.key === "Enter") {
          this.reevaluateState();
          if (this.getIsValid()) {
            this.getAggregation("submitButton").firePress();
          }
        }
      },
    });

    return E;
  }
);
