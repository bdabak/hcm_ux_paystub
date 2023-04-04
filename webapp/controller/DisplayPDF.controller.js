/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global location*/
sap.ui.define(
  [
    "com/sedef/hcm/ux/mypaystubs/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "com/sedef/hcm/ux/mypaystubs/utils/formatter",
    "sap/ui/core/HTML",
    "sap/ui/Device",
    "sap/m/Button",
  ],
  function (
    BaseController,
    JSONModel,
    History,
    formatter,
    HTML,
    Device,
    Button
  ) {
    "use strict";

    return BaseController.extend(
      "com.sedef.hcm.ux.mypaystubs.controller.DisplayPDF",
      {
        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the paystubs controller is instantiated.
         * @public
         */
        onInit: function () {
          //as of SAPUI5-version 1.48.* the control sap.m.PDFViewer is available
          var currentUI5Version = new sap.ui.core.Configuration().getVersion();
          this._bUsePDFViewerControl =
            currentUI5Version.compareTo(1, 48) < 0 ? false : true;

          this._oDetailPage = this.getView().byId("displayPDFPage");
          this._sSourceURL = null;

          // Model used to manipulate control states. The chosen values make sure,
          // detail page is busy indication immediately so there is no break in
          // between the busy indication for loading the view's meta data
          var iOriginalBusyDelay,
            oViewModel = new JSONModel({
              busy: true,
              delay: 0,
              showFooter: false,
            });

          if (!this._bUsePDFViewerControl) {
            // register event handler for the iframes 'onLoad' event
            sap.ui
              .getCore()
              .getEventBus()
              .subscribe(
                "com.sedef.hcm.ux.mypaystubs",
                "PDFLoaded",
                this.onPDFLoaded,
                this
              );
          }

          this.getRouter()
            .getRoute("displayPDF")
            .attachPatternMatched(this._onPDFMatched, this);

          // Store original busy indicator delay, so it can be restored later on
          iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
          this.setModel(oViewModel, "objectView");
          this.getOwnerComponent()
            .getModel()
            .metadataLoaded()
            .then(function () {
              // Restore original busy indicator delay for the object view
              oViewModel.setProperty("/delay", iOriginalBusyDelay);
            });
        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */
        /**
         * Event handler  for navigating back.
         * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
         * If not, it will replace the current entry of the browser history with the worklist route.
         * @public
         */
        onNavBack: function () {
          var sPreviousHash = History.getInstance().getPreviousHash(),
            oCrossAppNavigator =
              sap.ushell &&
              sap.ushell.Container &&
              sap.ushell.Container.getService("CrossApplicationNavigation");

          // remove all content from the detail page
          this._oDetailPage.destroyContent();

          if (
            sPreviousHash !== undefined ||
            !oCrossAppNavigator.isInitialNavigation()
          ) {
            // The history contains a previous entry
            oCrossAppNavigator.historyBack(1);
          } else {
            this.getRouter().navTo("paystubsList", {}, true);
          }
        },

        onExit: function () {
          sap.ui
            .getCore()
            .getEventBus()
            .unsubscribe(
              "com.sedef.hcm.ux.mypaystubs",
              "PDFLoaded",
              this.onPDFLoaded
            );
        },

        onPDFLoaded: function () {
          this.getModel("objectView").setProperty("/busy", false);
        },

        onOpenInNewWindowPressed: function () {
          sap.m.URLHelper.redirect(this._sSourceURL, true);
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

        /**
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onPDFMatched: function (oEvent) {
          var EmployeeID = oEvent.getParameter("arguments").EmployeeNumber,
            SequenceNumber = oEvent.getParameter("arguments").SequenceNumber,
            oViewModel = this.getModel("objectView");

          var oAppModel = this.getModel("appView");
          var oModel = this.getModel();
          var that = this;
          var verifySecretToken = this.verifySecretToken();

          oAppModel.setProperty("/busy", true);

          var fnResolve = function (isValid) {
            oAppModel.setProperty("/busy", false);
            if (!isValid) {
              that.getRouter().navTo("authorize", null, null, true);
            } else {
              oModel.metadataLoaded().then(
                function () {
                  var sObjectPath = oModel.createKey("PaystubDisplaySet", {
                    EmployeeNumber: EmployeeID,
                    SequenceNumber: SequenceNumber,
                  });

                  oViewModel.setProperty("/busy", Device.system.desktop);

                  this._sSourceURL =
                    oModel.sServiceUrl + "/" + sObjectPath + "/$value";

                  if (this._bUsePDFViewerControl) {
                    // use "sap.m.PDFViewer" control to display the PDF
                    var oPDFViewer = new sap.m.PDFViewer(
                      this.getView().createId("pdfViewer"),
                      {
                        source: this._sSourceURL,
                        loaded: this.onPDFLoaded.bind(this),
                        height: "99%",
                        title: Device.system.desktop
                          ? null
                          : this.getResourceBundle().getText(
                              "openPDFInNewWindow"
                            ),
                        showDownloadButton: !Device.system.desktop,
                      }
                    );
                    this._oDetailPage.addContent(oPDFViewer);
                  } else {
                    // go with the iframe workaround
                    var oHTML = new HTML(this.getView().createId("idHTML")),
                      sOnLoadEventHTML =
                        "sap.ui.getCore().getEventBus().publish('com.sedef.hcm.ux.mypaystubs', 'PDFLoaded')",
                      sHTML =
                        "<iframe src='" +
                        jQuery.sap.encodeHTML(this._sSourceURL) +
                        "' onLoad='" +
                        jQuery.sap.encodeHTML(sOnLoadEventHTML) +
                        "' width='100%' height='99%' type='application/pdf'/>";
                    oHTML.setContent(sHTML);

                    this._oDetailPage.addContent(oHTML);

                    // on phone and tablet we offer a footer button to open the PDF in a new/separate window
                    if (!Device.system.desktop) {
                      this._oDetailPage.destroyCustomFooterContent();

                      var oOpenAsPDFButton = new Button(
                        this.getView().createId("openAsPdfButton"),
                        {
                          text: this.getResourceBundle().getText(
                            "openPDFInNewWindow"
                          ),
                          tooltip:
                            this.getResourceBundle().getText(
                              "openPDFInNewWindow"
                            ),
                          press: this.onOpenInNewWindowPressed.bind(this),
                        }
                      );

                      this._oDetailPage.addCustomFooterContent(
                        oOpenAsPDFButton
                      );

                      oViewModel.setProperty("/showFooter", true);
                    }
                  }
                }.bind(that)
              );
            }
          };

          var fnReject = function () {
            oAppModel.setProperty("/busy", false);
            //No calls should be made here
          };

          verifySecretToken.then(fnResolve, fnReject);
        },
      }
    );
  }
);
