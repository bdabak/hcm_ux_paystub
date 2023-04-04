sap.ui.define(
  [
    "com/sedef/hcm/ux/mypaystubs/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "com/sedef/hcm/ux/mypaystubs/utils/formatter",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
  ],
  function (BaseController, JSONModel, formatter, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend(
      "com.sedef.hcm.ux.mypaystubs.controller.Authorize",
      {
        formatter: formatter,
        extHookAdjustViewModel: null,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the paystubs controller is instantiated.
         * @public
         */
        onInit: function () {
          var oViewModel;
          // Model used to manipulate control states
          oViewModel = new JSONModel({
            busy: false,
            passCode: null,
            showSms: false,
            showPin: false,
          });

          this.setModel(oViewModel, "authorizeModel");

          this.getRouter()
            .getRoute("authorize")
            .attachPatternMatched(this.onAuthorizeCalled, this);

          this.startTokenChecker();
        },
        setInitialModelState: function () {
          var oViewModel = this.getModel("authorizeModel");

          oViewModel.setProperty("/passCode", null);
          oViewModel.setProperty("/showSms", false);
          oViewModel.setProperty("/showPin", false);
        },
        onAuthorizeCalled: function () {
          var oModel = this.getModel();
          var oViewModel = this.getModel("authorizeModel");

          this.setInitialModelState();

          oViewModel.setProperty("/busy", true);
          oModel.callFunction("/GetAuthorizationCode", {
            method: "POST",
            urlParameters: {},
            success: function (oData, oResponse) {
              oViewModel.setProperty("/busy", false);
              if (oData.Passc !== "") {
                oViewModel.setProperty("/passCode", oData.Passc);
                oViewModel.setProperty("/showSms", true);
                oViewModel.setProperty("/showPin", true);
              } else {
                oViewModel.setProperty("/passCode", null);
                oViewModel.setProperty("/showSms", true);
                oViewModel.setProperty("/showPin", false);
              }
            },
            error: function (oError) {
              oViewModel.setProperty("/busy", false);
            },
          });
        },
        onVerifyPressed: function (oEvent) {
          var oModel = this.getModel();
          var oViewModel = this.getModel("authorizeModel");
          var sSecret = oEvent.getParameter("value");
          var sRefCode = oViewModel.getProperty("/passCode");
          var oCodeInput = this.getView().byId("secretCodeInput");
          var that = this;

          oViewModel.setProperty("/busy", true);

          oModel.callFunction("/VerifyAuthorizationCode", {
            method: "POST",
            urlParameters: {
              ReferenceCode: sRefCode,
              SecretKey: sSecret,
            },
            success: function (oData, oResponse) {
              oViewModel.setProperty("/busy", false);

              if (oData.Error !== "") {
                oCodeInput.invalidateCells();
                MessageBox.error(oData.Messg);
                switch (oData.Error) {
                  case "TIMED_OUT":
                    oViewModel.setProperty("/passCode", null);
                    oViewModel.setProperty("/showSms", true);
                    oViewModel.setProperty("/showPin", false);
                    break;
                  case "INVALID":
                    oViewModel.setProperty("/showSms", true);
                    oViewModel.setProperty("/showPin", true);
                    break;
                  default:
                    oViewModel.setProperty("/passCode", null);
                    oViewModel.setProperty("/showSms", true);
                    oViewModel.setProperty("/showPin", false);
                    break;
                }
              } else {
                MessageToast.show("Doğrulama başarılı");
                that.setSecretToken(oData.Token);
                that.getRouter().navTo("paystubsList", null, null, true);
              }
            },
            error: function (oError) {
              oViewModel.setProperty("/busy", false);
              MessageToast.show("Doğrulama sırasında hata oluştu!"); //789890
            },
          });
        },
        onLoginViaSms: function () {
          var oModel = this.getModel();
          var oViewModel = this.getModel("authorizeModel");

          this.setInitialModelState();

          oViewModel.setProperty("/busy", true);

          oModel.callFunction("/SendAuthorizationCode", {
            method: "POST",
            urlParameters: {},
            success: function (oData, oResponse) {
              oViewModel.setProperty("/busy", false);
              if (oData.Passc !== "") {
                oViewModel.setProperty("/passCode", oData.Passc);
                oViewModel.setProperty("/showSms", true);
                oViewModel.setProperty("/showPin", true);
              } else {
                if (oData.Error !== "") {
                  MessageBox.error(oData.Messg);
                }
                oViewModel.setProperty("/passCode", null);
                oViewModel.setProperty("/showSms", true);
                oViewModel.setProperty("/showPin", false);
              }
            },
            error: function (oError) {
              oViewModel.setProperty("/busy", false);
              MessageToast.show("Yeni kod alınırken gönderiminde hata oluştu!");
            },
          });

          // 004707
          // XS4848

          //this.getRouter().navTo("paystubsList");
        },
      }
    );
  }
);
