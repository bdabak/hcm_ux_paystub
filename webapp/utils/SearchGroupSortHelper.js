/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
// Creates a sub-controller to be used by the master controller to handle specifically filtering, grouping, and sorting
// dialogs
sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/model/Sorter",
	"sap/m/GroupHeaderListItem",
	"sap/m/ViewSettingsItem",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/format/NumberFormat",
	"sap/ui/Device"
], function (Object, Sorter, GroupHeaderListItem, ViewSettingsItem, DateFormat, Filter, FilterOperator, NumberFormat, Device) {

	return Object.extend("com.sedef.hcm.ux.mypaystubs.utils.SearchGroupSortHelper", {
		_oResourceBundle: null,
		_oView: null,
		_oTable: null,
		_oGroupDialog: null,
		_oSortDialog: null,

		constructor: function (oModel, oView, oResourceBundle, oTable) {
			this._oModel = oModel;
			this._oResourceBundle = oResourceBundle;
			this._oView = oView;
			this._oTable = oTable;
			this._currentEmployeeID = this._oView.getModel("paystubsView").getProperty("/currentEmployeeID");

			this._oDefaultFilter = this._currentEmployeeID ? new Filter("EmployeeNumber", FilterOperator.EQ, this._currentEmployeeID) : null;

			//keeps the sort state
			this._oDefaultSorter = new Sorter("PayDate", true);
			this._aTableSortState = [this._oDefaultSorter];

			//keeps the group state
			this._oDefaultGrouper = new Sorter("PayrollYear", true, this._oGroupFunctions.PayrollYear.bind(this));
			this._aTableGroupState = Device.system.desktop ? [this._oDefaultGrouper] : [];
		},

		getActiveFilters: function () {
			return this._oDefaultFilter ? [this._oDefaultFilter] : [];
		},

		getActiveSorters: function () {
			return this._aTableGroupState.concat(this._aTableSortState);
		},

		setCurrentEmployeeID: function (employeeID) {
			this._currentEmployeeID = employeeID;
			this._oDefaultFilter = new Filter("EmployeeNumber", FilterOperator.EQ, this._currentEmployeeID);
		},

		openSortDialog: function (oEvent) {
			if (!this._oSortDialog) {
				this._oSortDialog = sap.ui.xmlfragment("com.sedef.hcm.ux.mypaystubs.view.fragment.PaystubSortDialog", this);
				this._oView.addDependent(this._oSortDialog);
			}
			this._oSortDialog.open();
		},

		/**
		 * Event handler for the Confirm button of the sort dialog
		 * @param {sap.ui.base.Event} oEvent the viewSettingsDialog confirm event
		 * @public
		 */
		onSortDialogConfirmed: function (oEvent) {
			var mParams = oEvent.getParameters();
			var oTableBinding = this._oTable.getBinding("items");
			var sPath, bDescending, oSorter;

			this._aTableSortState = [];
			if (mParams.sortItem) {
				sPath = mParams.sortItem.getKey();
				bDescending = mParams.sortDescending;

				oSorter = new Sorter(sPath, bDescending);
				if (sPath === "NetpayAmount" ||
					sPath === "DeductionAmount" ||
					sPath === "GrosspayAmount") {
					oSorter.fnCompare = this._oSortFunctions.AmountComparison;
				}
				this._aTableSortState.push(oSorter);
			} else {
				this._aTableSortState = [this._oDefaultSorter];
			}
			this._applySort(oTableBinding);
		},

		openGroupingDialog: function (oEvent) {
			if (!this._oGroupDialog) {
				this._oGroupDialog = sap.ui.xmlfragment("com.sedef.hcm.ux.mypaystubs.view.fragment.PaystubGroupDialog", this);
				if (Device.system.desktop) {
					var aList = this._oGroupDialog.getGroupItems();
					this._oGroupDialog.setSelectedGroupItem(aList[0]);
				}
				this._oView.addDependent(this._oGroupDialog);
			}
			this._oGroupDialog.open();
		},

		/**
		 * Event handler for the Confirm button of the group dialog
		 * @param {sap.ui.base.Event} oEvent the viewSettingsDialog confirm event
		 * @public
		 */
		onGroupDialogConfirmed: function (oEvent) {
			var mParams = oEvent.getParameters();
			var oTableBinding = this._oTable.getBinding("items");
			var sPath, bDescending;

			// apply sorter to binding
			// (grouping comes before sorting)
			this._aTableGroupState = [];
			if (mParams.groupItem) {
				sPath = mParams.groupItem.getKey();
				bDescending = mParams.groupDescending;
				var vGroup = this._oGroupFunctions[sPath].bind(this);
				this._aTableGroupState.push(new Sorter(sPath, bDescending, vGroup));
			}
			this._applySort(oTableBinding);
		},

		createGroupHeader: function (oGroup) {
			return new GroupHeaderListItem({
				title: oGroup.text,
				upperCase: false
			});
		},

		getDefaultGroup: function (oContext) {
			var fGrouper = this._oGroupFunctions.PayrollYear.bind(this);
			return fGrouper(oContext);
		},

		/**
		 * Helper method to apply both filter and search state together on the list binding
		 * @param {string} the entered search term
		 * @private
		 */
		performLocalSearch: function (sQuery) {
			var oListBinding = this._oTable.getBinding("items");
			var oFinalFilter;
			if (sQuery && sQuery.length > 0) {
				var aFilters = [];
				aFilters = this._addTextualFilters(aFilters, sQuery);
				aFilters = this._addAmountFilters(aFilters, sQuery);
				aFilters = this._addDateFilters(aFilters, sQuery);
				aFilters = this._addDateTextFilters(aFilters, sQuery);

				oFinalFilter = new Filter([
					this._oDefaultFilter,
					new Filter(aFilters, false)
				], true);
			} else {
				this._oView.getModel("paystubsView").setProperty("/tableNoDataText", this._oResourceBundle.getText("noObjectsAvailableText"));
				oFinalFilter = this._oDefaultFilter;
			}
			oListBinding.filter(oFinalFilter, "Application");

			// changes the noDataText of the list in case there are no filter results
			if (oListBinding.iLength === 0 && sQuery && sQuery.length > 0) {
				var oViewModel = this._oView.getModel("paystubsView");
				oViewModel.setProperty("/tableNoDataText", this._oResourceBundle.getText("paystubNoDataWithSearchText"));
			}
		},

		_addDateFilters: function (aFilters, sQuery) {
			if (sQuery.length > 7) {
				//date-based search
				var dateParsed = DateFormat.getDateInstance({
					style: "long"
				}).parse(sQuery, true, true);
				if (dateParsed) {
					//Pay Date
					aFilters.push(new Filter("PayDate", FilterOperator.EQ, dateParsed));

					//Bonus Date
					aFilters.push(new Filter("BonusDate", FilterOperator.EQ, dateParsed));

					//Payroll Period interval
					aFilters.push(new Filter({
						filters: [new Filter("PayrollPeriodStartDate", FilterOperator.LE, dateParsed),
							new Filter("PayrollPeriodEndDate", FilterOperator.GE, dateParsed)
						],
						and: true
					}));
				}
			}

			return aFilters;
		},

		_addDateTextFilters: function (aFilters, sQuery) {
			var that = this;
			that._sQuery = sQuery;
			that._dateFormatLong = DateFormat.getDateInstance({
				style: "long"
			});
			that._dateFormatMedium = DateFormat.getDateInstance({
				style: "medium"
			});

			var fnDateFilter = this._oFilterFunctions.PayBonusDateFilter.bind(that);
			//Pay Date filter
			aFilters.push(new Filter({
				path: "PayDate",
				test: fnDateFilter
			}));
			//Bonus Date filter
			aFilters.push(new Filter({
				path: "BonusDate",
				test: fnDateFilter
			}));

			return aFilters;
		},

		_addTextualFilters: function (aFilters, sQuery) {
			//textual search
			var fnTextualNonCaseSensitiveFilter = this._oFilterFunctions.TextualNonCaseSensitiveFilter.bind(this);

			//Payroll Type Text 
			aFilters.push(new Filter({
				path: "PayrollTypeText",
				test: fnTextualNonCaseSensitiveFilter
			}));
			//Offcycle Reason Text 
			aFilters.push(new Filter({
				path: "OffcycleReasonText",
				test: fnTextualNonCaseSensitiveFilter
			}));

			if (sQuery.length < 5) {
				if (!isNaN(sQuery)) {
					aFilters.push(new Filter("PayrollYear", FilterOperator.StartsWith, sQuery));
				}
				if (sQuery.length > 2) {
					aFilters.push(new Filter("Currency", FilterOperator.StartsWith, sQuery));
				}
			}

			return aFilters;
		},

		_addAmountFilters: function (aFilters, sQuery) {
			var that = this;
			that._sQuery = sQuery;
			that._numberFormat = NumberFormat.getCurrencyInstance();

			var fnAmountFilter = this._oFilterFunctions.AmountFilter.bind(that);
			//Net Pay
			aFilters.push(new Filter({
				path: "NetpayAmount",
				test: fnAmountFilter
			}));
			//Gross Pay
			aFilters.push(new Filter({
				path: "GrosspayAmount",
				test: fnAmountFilter
			}));
			//Deductions
			aFilters.push(new Filter({
				path: "DeductionAmount",
				test: fnAmountFilter
			}));

			return aFilters;
		},

		// The group functions are called during grouping for each item in the list. They determine which group
		// each list item belongs to. Items with the same key form a group. A new key
		// means a new group. The returned text is used as the label of the group item header.
		_oGroupFunctions: {
			// Grouping function for grouping by Payroll Year
			PayrollYear: function (oListItemContext) {
				return this._getGroup("PayrollYear", oListItemContext);
			},
			// Grouping function for grouping by Payroll Type
			PayrollTypeText: function (oListItemContext) {
				return this._getGroup("PayrollTypeText", oListItemContext);
			}
		},

		// This is a generic grouping function for columns that contain strings. For those columns, the property's value is
		// used as the grouping key and the group header text is built using the column's label and the property's value.
		_getGroup: function (sName, oListItemContext) {
			var sKey = oListItemContext.getProperty(sName);
			var sLabel = this._oModel.getProperty("/#Paystub/" + sName + "/@sap:label");

			var sText = this._oResourceBundle.getText("groupingLabel", [sLabel, sKey]);
			return {
				key: sKey,
				text: sText
			};
		},

		_oFilterFunctions: {
			// Filter function for amount-based filtering
			AmountFilter: function (oValue) {
				if (!oValue) {
					return false;
				}
				var amountFormatted = this._numberFormat.format(oValue);
				return (amountFormatted.indexOf(this._sQuery) !== -1 ||
					oValue.indexOf(this._sQuery) !== -1);
			},
			// Filter function for Pay Date
			PayBonusDateFilter: function (oValue) {
				if (!oValue) {
					return false;
				}
				var sValueFormattedLong = this._dateFormatLong.format(new Date(oValue), true).toUpperCase(),
					sValueFormattedMedium = this._dateFormatMedium.format(new Date(oValue), true).toUpperCase(),
					sQueryUpper = this._sQuery.toUpperCase();
				return (sValueFormattedLong.indexOf(sQueryUpper) !== -1 ||
					sValueFormattedMedium.indexOf(sQueryUpper) !== -1);

			},
			// Filter function for textual filter non-case-sensitive
			TextualNonCaseSensitiveFilter: function (oValue) {
				var sValueTextUpper = oValue.toString().toUpperCase(),
					sQueryUpper = this._sQuery.toUpperCase();
				return sValueTextUpper.indexOf(sQueryUpper) !== -1;
			}
		},

		_oSortFunctions: {
			//custom compare function to ensure amount-comparison is "number-based"	
			AmountComparison: function (oValue1, oValue2) {
				if (parseFloat(oValue1) < parseFloat(oValue2)) {
					return -1;
				} else if (parseFloat(oValue1) > parseFloat(oValue2)) {
					return 1;
				} else {
					return 0;
				}
			}
		},

		_applySort: function (oTableBinding) {
			// Here the binding of the table items is updated with the currently active sorters 
			// It is assumed that all changes done by the user are immediately reflected in the table.
			// That means there is always just one change at a time. 
			if (oTableBinding) {
				// The grouping or sorting of the table has changed. The sorting on the binding needs to be updated.
				// Note that the sorter of the grouping has to be the first one in the list of sorters that is added
				// to the binding
				var aActiveSorters = this._aTableGroupState.concat(this._aTableSortState);
				oTableBinding.sort(aActiveSorters);
			}
		},

		onExit: function () {
			if (this._oSortDialog) {
				this._oSortDialog.destroy();
			}
			if (this._oGroupDialog) {
				this._oGroupDialog.destroy();
			}
		}
	});
});