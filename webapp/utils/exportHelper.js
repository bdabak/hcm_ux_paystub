/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/util/Export",
	"sap/ui/core/util/ExportTypeCSV",
	"com/sedef/hcm/ux/mypaystubs/utils/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel"
], function(Export, ExportTypeCSV, formatter, MessageBox, JSONModel) {
	"use strict";

	return {

		/**
		 * before exporting the table as CSV-file ask the user for confirmation
		 * @public
		 */
		onDataExport: function(oTable, oResourceBundle) {
			MessageBox.confirm(oResourceBundle.getText("dataExportConfirmation"), {
				title: oResourceBundle.getText("dataExportConfirm"),
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._doDataExport(oTable, oResourceBundle);
					}
				}.bind(this)
			});
		},

		/**
		 * exports the content of the table as .csv-file
		 * @public
		 */
		_doDataExport: function(oTable, oResourceBundle) {
			var aVisibleItems = oTable.getVisibleItems(),
				aData = [],
				aUnprintableColumns = ["downloadPDFCol", "printPDFCol"];

			//build local JSON model only from visible rows
			aVisibleItems.forEach(function(item) {
				if (!(item instanceof sap.m.GroupHeaderListItem)) {
					var aCells = item.getCells(),
						oJSONRow = {};
					aCells.forEach(function(cell, index) {
						var column = oTable.getColumns()[index],
							columnId = column.getId().substring(column.getId().lastIndexOf("--") + 2);
						if (!(column.getVisible()) || (aUnprintableColumns.indexOf(columnId)) !== -1) {
							return;
						}
						var value;
						if (cell instanceof sap.m.ObjectIdentifier) {
							value = cell.getTitle();
						} else if (cell instanceof sap.m.Text) {
							value = cell.getText();
						} else if (cell instanceof sap.m.ObjectNumber) {
							value = cell.getNumber() + " " + cell.getUnit();
						}
						oJSONRow[columnId] = value;
					});
					aData.push(oJSONRow);
				}
			});
			var oJSONModel = new JSONModel(aData);

			//build list of visible columns
			var aVisibleColumns = oTable.getColumns().filter(function(value) {
				return value.getProperty("visible");
			});
			var aColumns = [];
			aVisibleColumns.forEach(function(column) {
				var columnId = column.getId().substring(column.getId().lastIndexOf("--") + 2);
				if (aUnprintableColumns.indexOf(columnId) === -1) {
					aColumns.push({
						name: column.getHeader().getText(),
						template: {
							content: {
								path: columnId
							}
						}
					});
				}
			});

			var oExport = new Export({
				// Type that will be used to generate the content. Own ExportType's can be created to support other formats
				exportType: new ExportTypeCSV({
					separatorChar: ";"
				}),
				// Pass in the model
				models: oJSONModel,
				// binding information for the rows aggregation
				rows: {
					path: "/"
				},
				// column definitions with column name and binding info for the content
				columns: aColumns
			});

			// download exported file
			oExport.saveFile().catch(function(oError) {
				MessageBox.error(oResourceBundle.getText("exportError") + "\n\n" + oError);
			}).then(function() {
				oExport.destroy();
			});
		}
	};
});