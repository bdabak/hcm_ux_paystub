/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
  "use strict";

  return Controller.extend(
    "com.sedef.hcm.ux.mypaystubs.controller.BaseController",
    {
      /**
       * Convenience method for accessing the router.
       * @public
       * @returns {sap.ui.core.routing.Router} the router for this component
       */
      getRouter: function () {
        return sap.ui.core.UIComponent.getRouterFor(this);
      },

      /**
       * Convenience method for getting the view model by name.
       * @public
       * @param {string} [sName] the model name
       * @returns {sap.ui.model.Model} the model instance
       */
      getModel: function (sName) {
        return this.getView().getModel(sName);
      },

      setSecretToken: function (sToken) {
        var oAppModel = this.getOwnerComponent().getModel("appModel");
        oAppModel.setProperty("/secretToken", sToken);
      },

      getSecretToken: function () {
        var oAppModel = this.getOwnerComponent().getModel("appModel");
        return oAppModel.getProperty("/secretToken");
      },

      verifySecretToken: function () {
        var sSecretToken = this.getSecretToken();
        var oModel = this.getOwnerComponent().getModel();
        var that = this;

        return new Promise(function (resolve, reject) {
          if (!sSecretToken) {
            resolve(false);
          } else {
            oModel.callFunction("/VerifySecretToken", {
              method: "POST",
              urlParameters: {
                SecretToken: sSecretToken,
              },
              success: function (oData, oResponse) {
                if (oData.Error !== "") {
                  that.setSecretToken(null);
                  resolve(false);
                } else {
                  resolve(true);
                }
              },
              error: function (oError) {
                resolve(false);
              },
            });
          }
        });
      },

      tokenCheckTriggerFn: function () {
        var that = this;
        var verifyPromise = this.verifySecretToken();
        verifyPromise.then(function (isValid) {
          if (!isValid) {
            that.getRouter().navTo("authorize", null, null, true);
          }
        });
      },

      startTokenChecker: function () {
        var that = this;
        try {
          if (this._tokenCheckerTrigger) {
            clearInterval(this._tokenCheckerTrigger);
          }

          this._tokenCheckerTrigger = setInterval(
            that.tokenCheckTriggerFn.bind(that),
            120000
          );
        } catch (e) {
          console.log("Dump");
          console.log(e);
        }
      },

      /**
       * Convenience method for setting the view model.
       * @public
       * @param {sap.ui.model.Model} oModel the model instance
       * @param {string} sName the model name
       * @returns {sap.ui.mvc.View} the view instance
       */
      setModel: function (oModel, sName) {
        return this.getView().setModel(oModel, sName);
      },

      /**
       * Getter for the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },
    }
  );
});
