/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/LocaleData"
], function(DateFormat, LocaleData) {
	"use strict";

	return {

		/**
		 * extracts the service path from the given absolute URL
		 * @public
		 * @param {string} sURL absolute URL
		 * @returns {string} sURL service path
		 */
		formatURL: function(sMediaSrc) {
			var sUrl = "";
			if (sMediaSrc && typeof sMediaSrc === "string") {
				var oLink = document.createElement("a");
				oLink.href = sMediaSrc;
				sUrl = (oLink.pathname.charAt(0) === "/") ? oLink.pathname : "/" + oLink.pathname;
			}
			return sUrl;
		},

		/**
		 * Formats the given date accodingly
		 * @public
		 * @param {oDate} the date to be formatted
		 * @returns {oDatetring} oDate formatted date
		 */
		formatDate: function(oDate) {
			if (!oDate) {
				return "";
			}
			var dateFormat = DateFormat.getDateInstance({
				pattern: "dd.MM.yyyy",
				UTC: true,
				relative: false
			});
			return dateFormat.format(oDate);
		},

		formatPayPeriod: function(oPayrollType, oPeriodBegda, oPeriodEndda, oOffcycleReason) {
			var sFormatLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale(),
				dateFormat = DateFormat.getDateInstance({
					style: "medium",
					UTC: true
				});

			switch (oPayrollType) {
				case "A": //offcycle run
				case "C": //check
					return oOffcycleReason;
				default: //standard payroll run
					if (oPeriodBegda && oPeriodEndda) {
						var sDateRange = LocaleData.getInstance(sFormatLocale).getIntervalPattern("d - d");
						sDateRange = sDateRange.replace("{0}", dateFormat.format(oPeriodBegda));
						sDateRange = sDateRange.replace("{1}", dateFormat.format(oPeriodEndda));
						return sDateRange;
					} else {
						return "";
					}
			}
		},

		formatForPeriod: function(forPeriod) {
			if (forPeriod && forPeriod !== "000000") {
				var year = forPeriod.substring(0, 4);
				var number = forPeriod.substring(4, 6);
				return number + "/" + year;
			}
			return "";
		}
	};
});