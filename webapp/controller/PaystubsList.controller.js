/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(
  [
    "com/sedef/hcm/ux/mypaystubs/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "com/sedef/hcm/ux/mypaystubs/utils/formatter",
    "com/sedef/hcm/ux/mypaystubs/utils/SearchGroupSortHelper",
    "sap/ui/core/routing/History",
    "sap/m/TablePersoController",
    "sap/ui/Device",
    "sap/ui/model/Filter",
    "sap/m/MessageBox",
    "com/sedef/hcm/ux/mypaystubs/utils/exportHelper",
  ],
  function (
    BaseController,
    JSONModel,
    formatter,
    SearchGroupSortHelper,
    History,
    TablePersoController,
    Device,
    Filter,
    MessageBox,
    exportHelper
  ) {
    "use strict";

    return BaseController.extend(
      "com.sedef.hcm.ux.mypaystubs.controller.PaystubsList",
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
          var oViewModel,
            iOriginalBusyDelay,
            oModel = this.getOwnerComponent().getModel();

          // Put down paystubs table's original value for busy indicator delay,
          // so it can be restored later on. Busy handling on the table is
          // taken care of by the table itself.
          this._oTable = this.getView().byId("paystubsTable");
          this._oResourceBundle = this.getResourceBundle();
          this._oTablePersoController = null;
          this._oPDFViewer = null;

          // Model used to manipulate control states
          oViewModel = new JSONModel({
            paystubsTableTitle:
              this._oResourceBundle.getText("paystubsTableTitle"),
            tableNoDataText:
              this._oResourceBundle.getText("paystubDataLoading"),
            payPeriodColumnTitle: null,
            tableBusyDelay: 0,
            personalizationActive: false,
            exportButtonActive: Device.system.desktop,
            downloadActive: Device.system.desktop,
            printActive: Device.system.desktop && Device.browser.chrome,
            currentEmployeeID: null,
            toolbarEnabled: false,
            growingThreshold: Device.system.desktop ? 100 : 24, //100 is the default size limit of the ODATA-model
            directPDFDisplayMobile: false,
          });

          this._bSearchTriggered = false;

          /**
           * @ControllerHook
           * Allows you to adjust the oViewModel after the controller was initialized
           * @callback com.sedef.hcm.ux.mypaystubs.controller.PaystubsList~extHookAdjustViewModel
           * @param {sap.ui.model.json.JSONModel} oViewModel
           * @return {void}
           */
          if (this.extHookAdjustViewModel) {
            this.extHookAdjustViewModel(oViewModel);
          }

          // check whether 'printPDF'-functionality is active
          this._aElementsToBeDestroyed = [];
          if (!oViewModel.getProperty("/printActive")) {
            var oPrintColumn = this.byId("printPDFCol"),
              oPrintButton = this.byId("printPDFBtn");

            //ensure removed elements are destroyed once leaving the app (onExit)
            this._aElementsToBeDestroyed.push(oPrintColumn);
            this._aElementsToBeDestroyed.push(oPrintButton);

            this._oTable.removeColumn(oPrintColumn);
            this.getView().byId("columnListItem").removeCell(oPrintButton);
          }

          // check whether 'downloadPDF'-functionality is active
          if (!oViewModel.getProperty("/downloadActive")) {
            var oDownloadColumn = this.byId("downloadPDFCol"),
              oDownloadButton = this.byId("downloadPDFBtn");

            //ensure removed elements are destroyed once leaving the app (onExit)
            this._aElementsToBeDestroyed.push(oDownloadColumn);
            this._aElementsToBeDestroyed.push(oDownloadButton);

            this._oTable.removeColumn(oDownloadColumn);
            this.getView().byId("columnListItem").removeCell(oDownloadButton);
          }

          this.getView().setModel(oViewModel, "paystubsView");

          oModel.metadataLoaded().then(function () {
            oViewModel.setProperty(
              "/payPeriodColumnTitle",
              oModel.getProperty("/#Paystub/PayrollPeriod/@sap:label")
            );
          });

          sap.ui
            .getCore()
            .getEventBus()
            .subscribe(
              "com.sedef.hcm.ux.mypaystubs",
              "PrintPDFLoaded",
              this.onPrintPDFLoaded,
              this
            );

          // Make sure, busy indication is showing immediately so there is no
          // break after the busy indication for loading the view's meta data is
          // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
          iOriginalBusyDelay = this._oTable.getBusyIndicatorDelay();
          this._oTable.attachEventOnce("updateFinished", function () {
            // Restore original busy indicator delay for paystub's table
            oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
          });

          this.getRouter()
            .getRoute("paystubsList")
            .attachPatternMatched(this._onPaystubsListMatched, this);

          // Prepare the personalization service for the paystub table
          this._initPersonalization();
        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */
        /**
         * Triggered by the table's 'updateFinished' event: after new table
         * data is available, this handler method updates the table counter.
         * This should only happen if the update was successful, which is
         * why this handler is attached to 'updateFinished' and not to the
         * table's list binding's 'dataReceived' method.
         * @param {sap.ui.base.Event} oEvent the update finished event
         * @public
         */
        onUpdateFinished: function (oEvent) {
          // update the paystub's object counter after the table update
          var sTitle,
            sNoDataText,
            oTable = oEvent.getSource(),
            oBinding = oTable.getBinding("items"),
            oViewModel = this.getModel("paystubsView"),
            iTotalItems = oEvent.getParameter("total");

          if (!(iTotalItems && oBinding.isLengthFinal())) {
            sNoDataText = this._bSearchTriggered
              ? this._oResourceBundle.getText("paystubNoDataWithSearchText")
              : this._oResourceBundle.getText("paystubNoData");
            oViewModel.setProperty("/tableNoDataText", sNoDataText);
            this._bSearchTriggered = false;
          }

          //dynamically adjust column header for the payroll period
          oViewModel.setProperty(
            "/payPeriodColumnTitle",
            this._getPayrollTypeColumnTitle(oTable.getVisibleItems())
          );

          sTitle = this._oResourceBundle.getText("paystubsTableTitleCount", [
            iTotalItems,
          ]);
          oViewModel.setProperty("/paystubsTableTitle", sTitle);
          oViewModel.setProperty("/toolbarEnabled", true);
          this.getView().byId("pullToRefresh").hide();
        },

        onUpdateStarted: function (oEvent) {
          var oViewModel = this.getModel("paystubsView");

          oViewModel.setProperty(
            "/tableNoDataText",
            this._oResourceBundle.getText("paystubDataLoading")
          );
        },

        onDataReceived: function (oData) {
          if (oData) {
            this.getView().byId("pullToRefresh").hide();
          }
        },

        /**
         * Event handler when a table item gets pressed
         * @param {sap.ui.base.Event} oEvent the table itemPress event
         * @public
         */
        onPress: function (oEvent) {
          if (
            !Device.system.desktop &&
            this.getModel("paystubsView").getProperty("/directPDFDisplayMobile")
          ) {
            var oModel = this.getOwnerComponent().getModel();

            oModel.setHeaders({
              "secret-token": this.getSecretToken(),
            });
            var sPDFUrl = formatter.formatURL(
              oEvent
                .getSource()
                .getBindingContext()
                .getProperty("toPaystubDisplay/__metadata/media_src")
            );
            sap.m.URLHelper.redirect(sPDFUrl, true);
          } else {
            this._showObject(oEvent.getSource());
          }
        },

        onPrintPDF: function (oEvent) {
          var sOnLoadEventHTML =
              "sap.ui.getCore().getEventBus().publish('com.sedef.hcm.ux.mypaystubs', 'PrintPDFLoaded')",
            id = this.getView().byId("idHTML").getId(),
            PDFUrl = formatter.formatURL(
              oEvent
                .getSource()
                .getBindingContext()
                .getProperty("toPaystubDisplay/__metadata/media_src")
            );

          var sHTML =
            "<div id='" +
            id +
            "'><iframe id='printIframe' src='" +
            jQuery.sap.encodeHTML(PDFUrl) +
            "' onLoad='" +
            jQuery.sap.encodeHTML(sOnLoadEventHTML) +
            "' style='display:none' type='application/pdf'/></div>";

          this.getView().byId("idHTML").setContent(sHTML);
        },

        onPrintPDFLoaded: function () {
          var iFrame = jQuery("#printIframe");
          iFrame[0].focus();
          iFrame[0].contentWindow.print();
        },

        onDownloadPDF: function (oEvent) {
          //as of SAPUI5-version 1.48.* the control sap.m.PDFViewer is available
          var currentUI5Version = new sap.ui.core.Configuration().getVersion(),
            bUsePDFViewerControl =
              currentUI5Version.compareTo(1, 48) < 0 ? false : true,
            sPDFUrl = formatter.formatURL(
              oEvent
                .getSource()
                .getBindingContext()
                .getProperty("toPaystubDownload/__metadata/media_src")
            );

          if (bUsePDFViewerControl) {
            // use "sap.m.PDFViewer" to download the PDF
            if (!this._oPDFViewer) {
              this._oPDFViewer = new sap.m.PDFViewer(
                this.getView().createId("pdfViewer"),
                {
                  source: sPDFUrl,
                }
              );
              this.getView().addDependent(this._oPDFViewer);
            } else {
              this._oPDFViewer.setSource(sPDFUrl);
            }

            this._oPDFViewer.downloadPDF();
          } else {
            var id = this.getView().byId("idHTML").getId(),
              sHTML =
                "<div id='" +
                id +
                "'><iframe src='" +
                jQuery.sap.encodeHTML(sPDFUrl) +
                "' style='display:none' type='application/pdf'/></div>";

            this.getView().byId("idHTML").setContent(sHTML);
          }
        },

        onEmailPDF: function (oEvent) {
          var oButton = oEvent.getSource();
          var oContext = oButton.getBindingContext();
          var oObject = oContext.getObject();
          var sEmployeeNumber = oObject["EmployeeNumber"];
          var sSequenceNumber = oObject["SequenceNumber"];
          var oModel = this.getModel();
          var oAppModel = this.getModel("appView");
          var that = this;

          oAppModel.setProperty("/busy", true);

          oModel.callFunction("/SendPayslipViaEmail", {
            method: "POST",
            urlParameters: {
              EmployeeNumber: sEmployeeNumber,
              SequenceNumber: parseInt(sSequenceNumber, 10),
            },
            success: function (oData, oResponse) {
              oAppModel.setProperty("/busy", false);

              if (oData && oData.Type === "S") {
                oButton.setEnabled(false);
                MessageBox.success(
                  that._oResourceBundle.getText("payslipEmailSuccessContent"),
                  {
                    title: that._oResourceBundle.getText(
                      "payslipEmailSuccessTitle"
                    ), // default
                  }
                );
              } else {
                MessageBox.warning(
                  that._oResourceBundle.getText("payslipEmailFailedContent"),
                  {
                    title: that._oResourceBundle.getText(
                      "payslipEmailFailedTitle"
                    ), // default
                  }
                );
              }
            },
            error: function (oError) {
              oAppModel.setProperty("/busy", false);
              MessageBox.warning(
                that._oResourceBundle.getText("payslipEmailFailedContent"),
                {
                  title: that._oResourceBundle.getText(
                    "payslipEmailFailedTitle"
                  ), // default
                }
              );
            },
          });
        },

        /**
         * Event handler for navigating back.
         * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
         * If not, it will navigate to the shell home
         * @public
         */
        onNavBack: function () {
          var sPreviousHash = History.getInstance().getPreviousHash(),
            oCrossAppNavigator =
              sap.ushell &&
              sap.ushell.Container &&
              sap.ushell.Container.getService("CrossApplicationNavigation");

          if (
            sPreviousHash !== undefined ||
            !oCrossAppNavigator.isInitialNavigation()
          ) {
            // The history contains a previous entry
            oCrossAppNavigator.historyBack(1);
          } else {
            // Navigate back to FLP home
            oCrossAppNavigator.toExternal({
              target: {
                shellHash: oCrossAppNavigator.hrefForExternal({
                  target: {
                    shellHash: "#",
                  },
                }),
              },
            });
          }
        },

        onExit: function () {
          this._aElementsToBeDestroyed.forEach(function (oElement) {
            oElement.destroy();
          });
          if (this._oSortGroupHelper) {
            this._oSortGroupHelper.onExit();
          }
          sap.ui
            .getCore()
            .getEventBus()
            .unsubscribe(
              "com.sedef.hcm.ux.mypaystubs",
              "PrintPDFLoaded",
              this.onPrintPDFLoaded
            );

          if (this._oTablePersoController) {
            var oTablePersoDialog =
              this._oTablePersoController.getTablePersoDialog();
            if (oTablePersoDialog) {
              oTablePersoDialog.destroy();
            }
          }
        },

        onPersoButtonPressed: function (oEvent) {
          this._oTablePersoController.openDialog();
        },

        onLiveChange: function (oEvent) {
          if (Device.system.desktop) {
            this._oSortGroupHelper.performLocalSearch(
              oEvent.getParameter("newValue")
            );
            this._bSearchTriggered = true;
          }
        },

        onSearch: function (oEvent) {
          if (oEvent.getParameters().refreshButtonPressed) {
            // Search field's 'refresh' button has been pressed.
            // This is visible if you select any master list item.
            // In this case no new search is triggered, we only
            // refresh the list binding.
            this.onRefresh(oEvent);
          } else {
            if (Device.system.desktop) {
              this._oSortGroupHelper.performLocalSearch(
                oEvent.getParameter("query")
              );
            } else {
              this._performGlobalSearch(oEvent.getParameter("query"));
            }
            this._bSearchTriggered = !oEvent.getParameters().clearButtonPressed;
          }
        },

        onSortPressed: function (oEvent) {
          this._oSortGroupHelper.openSortDialog(oEvent);
        },

        onGroupPressed: function (oEvent) {
          this._oSortGroupHelper.openGroupingDialog(oEvent);
        },

        onDataExport: function (oEvent) {
          exportHelper.onDataExport(this._oTable, this._oResourceBundle);
        },

        onRefresh: function (oEvent) {
          var oBinding = this._oTable.getBinding("items");
          oBinding.refresh();
        },

        onAssignmentsLoaded: function (oEvent) {
          var sDefaultAssignment = oEvent.getParameter("defaultAssignment");
          this._changeOfEmployeeID(sDefaultAssignment, true);
          // this.getOwnerComponent()
          //   .getModel()
          //   .metadataLoaded()
          //   .then(
          //     function () {
          //       this._changeOfEmployeeID(sDefaultAssignment, true);
          //       this._delayedInit();
          //     }.bind(this)
          //   );
        },

        onAssignmentSwitch: function (oEvent) {
          var sChosenEmployeeID = oEvent.getParameter("selectedAssignment");
          this._changeOfEmployeeID(sChosenEmployeeID, false);

          this.getView()
            .getModel("paystubsView")
            .setProperty("/toolbarEnabled", false);

          this._updateListBinding();
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */
        _delayedInit: function () {
          var sSecretToken = this.getSecretToken();

          if (!sSecretToken) {
            this.getRouter().navTo("authorize");
            return;
          }

          // Initialize the Helper class for the sort, group and search functionality
          this._oSortGroupHelper = new SearchGroupSortHelper(
            this.getOwnerComponent().getModel(),
            this.getView(),
            this._oResourceBundle,
            this._oTable
          );

          // Bind the relevant items to the table
          this._updateListBinding();
        },

        _changeOfEmployeeID: function (sNewEmployeeID, isLateInit) {
          this.getView()
            .getModel("paystubsView")
            .setProperty("/currentEmployeeID", sNewEmployeeID);
          if (!isLateInit) {
            this._oSortGroupHelper.setCurrentEmployeeID(sNewEmployeeID);
            this._oTable
              .getBinding("items")
              .filter(this._oSortGroupHelper.getActiveFilters());
          }
        },

        /**
         * the search is triggered against the global ODATA-model;
         * an entered search value is passed to the list binding as
         * custom 'search' parameter
         * @param {String} sQuery the search term entered by the user
         * @private
         */
        _performGlobalSearch: function (sQuery) {
          this._updateListBinding(sQuery);
        },

        /**
         * update the tables list binding with the provided parameters
         * if a search value was entered by the user we use the custom
         * ODATA-'search' parameter to pass a search string to the backend
         * @param {String} sQuery the search term entered by the user
         * @private
         */
        _updateListBinding: function (sQuery) {
          this._oColumListItemTemplate = this._oColumListItemTemplate
            ? this._oColumListItemTemplate.clone()
            : this.getView().byId("columnListItem");

          var oModel = this.getOwnerComponent().getModel();

          oModel.setHeaders({
            "secret-token": this.getSecretToken(),
          });

          var sObjectPath = oModel.createKey("EmployeeAssignmentSet", {
            EmployeeNumber: this.getView()
              .getModel("paystubsView")
              .getProperty("/currentEmployeeID"),
          });
          sObjectPath = "/" + sObjectPath + "/toPaystubs";

          this._oTable.bindItems({
            path: sObjectPath,
            parameters: {
              operationMode: Device.system.desktop ? "Client" : "Default",
              custom: sQuery
                ? {
                    search: encodeURIComponent(sQuery),
                  }
                : {},
              expand: "toPaystubDisplay,toPaystubDownload",
            },
            template: this._oColumListItemTemplate,
            sorter: this._oSortGroupHelper.getActiveSorters(),
            filters: this._oSortGroupHelper.getActiveFilters(),
            groupHeaderFactory: this._createGroupHeader.bind(this),
            events: {
              dataReceived: this.onDataReceived.bind(this),
            },
          });
        },

        _getPayrollTypeColumnTitle: function (aPaystubItems) {
          var oModel = this.getOwnerComponent().getModel();
          try {
            var payrollType = this._getUniquePayrollType(aPaystubItems);
            switch (payrollType) {
              case "": //Regular Payroll
                return oModel.getProperty("/#Paystub/PayrollPeriod/@sap:label");
              default: //Off-cycle Run
                return oModel.getProperty(
                  "/#Paystub/OffcycleReasonText/@sap:label"
                );
            }
          } catch (e) {
            //payroll type is not unique
            return this._oResourceBundle.getText(
              "payPeriodPlusOffcycleColTitle"
            );
          }
        },

        _getUniquePayrollType: function (aPaystubItems) {
          var exception = {};
          if (!this._isPayrollTypeUnique(aPaystubItems)) {
            throw exception;
          }
          // as payroll type is unique we take the first one (element [0] might be a GroupHeaderListItem)
          return aPaystubItems[1]
            .getBindingContext()
            .getProperty("PayrollType");
        },

        _isPayrollTypeUnique: function (aPaystubItems) {
          var prevPayrollType,
            currPayrollType,
            isUniquePayrollType = true;

          aPaystubItems.forEach(function (item) {
            if (!(item instanceof sap.m.GroupHeaderListItem)) {
              currPayrollType = item
                .getBindingContext()
                .getProperty("PayrollType");
              if (
                prevPayrollType !== undefined &&
                prevPayrollType !== currPayrollType
              ) {
                isUniquePayrollType = false;
                // break;
              }
              prevPayrollType = currPayrollType;
            }
          });
          return isUniquePayrollType;
        },

        /**
         * Shows the selected item on the displayPDF page
         * @param {sap.m.ObjectListItem} oItem selected Item
         * @private
         */
        _showObject: function (oItem) {
          this.getRouter().navTo("displayPDF", {
            EmployeeNumber: oItem
              .getBindingContext()
              .getProperty("EmployeeNumber"),
            SequenceNumber: oItem
              .getBindingContext()
              .getProperty("SequenceNumber"),
          });
        },

        _createGroupHeader: function (oGroup) {
          return this._oSortGroupHelper.createGroupHeader(oGroup);
        },

        _getDefaultGroup: function (oGroup) {
          return this._oSortGroupHelper.getDefaultGroup(oGroup);
        },

        // The personalization service for the paystubs list is created here.
        // It is used to store the following user settings: Visible columns, order of columns
        // The stored settings are applied automatically the next time the app starts.
        _initPersonalization: function () {
          if (sap.ushell.Container) {
            var oPersonalizationService =
              sap.ushell.Container.getService("Personalization");
            var oPersonalizer = oPersonalizationService.getPersonalizer({
              container: "com.sedef.hcm.ux.mypaystubs", // This key must be globally unique (use a key to identify the app) -> only 40 characters are allowed
              item: "myPaystubsTable", // Maximum of 40 characters applies to this key as well
            });
            this._oTablePersoController = new TablePersoController({
              table: this._oTable,
              componentName: "MyPaystubs",
              persoService: oPersonalizer,
            }).activate();
            this.getModel("paystubsView").setProperty(
              "/personalizationActive",
              true
            );
          }
        },
        _onPaystubsListMatched: function () {
          var oAppModel = this.getModel("appView");
          var that = this;
          var verifySecretToken = this.verifySecretToken();

          oAppModel.setProperty("/busy", true);

          var fnResolve = function (isValid) {
            oAppModel.setProperty("/busy", false);
            if (!isValid) {
              that.getRouter().navTo("authorize", null, null, true);
            } else {
              that
                .getOwnerComponent()
                .getModel()
                .metadataLoaded()
                .then(
                  function () {
                    that._delayedInit();
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
