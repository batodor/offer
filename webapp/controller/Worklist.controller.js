/*global location history */
sap.ui.define([
		"Offer/Offer/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"Offer/Offer/model/formatter",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
		'sap/m/MessageBox',
		'sap/m/MessageToast'
	], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, MessageToast) {
		"use strict";

		return BaseController.extend("Offer.Offer.controller.Worklist", {

			formatter: formatter,
			
			onInit : function () {
				// Model used to manipulate control states
				var oViewModel = new JSONModel({
					worklistTableTitle : this.getResourceBundle().getText("worklistTableTitle"),
					saveAsTileTitle: this.getResourceBundle().getText("saveAsTileTitle", this.getResourceBundle().getText("worklistViewTitle")),
					shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
					shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
					shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
					tableNoDataText : this.getResourceBundle().getText("tableNoDataText"),
					tableBusyDelay : 0
				});
				this.setModel(oViewModel, "worklistView");
				
				// Declare global filter
			    this.search = {}; // for searchFields
				this.typeArr = ["value", "dateValue", "selectedKey", "selected", "state", "tokens"];
				
				// Add fragments
				var fragmentsArr = [ "counterpartyPopupDialog", "portPopupDialog", "currencyPopupDialog", "volumeUomPopupDialog", "volumes", "periodsPrices", "approveDialog",
					"offerPopupDialog"];
				this.addFragments(fragmentsArr);
				
				this.getRouter().getRoute("worklist").attachPatternMatched(this._onOfferMatched, this);
				this.isRisk = {};
				this.isChanged = false;
				this.isLimitsChanged = false;
				this.isRisksChanged = false;
				this.isBlacklistChanged = false;
				this.deleteCounter = 0;
				this.isBlacklist = false;
				sap.ui.core.LocaleData.getInstance(sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale()).mData["weekData-firstDay"] = 1;
			},
			
			// After offer loaded, sets the mode Create/Edit
			_onOfferMatched: function(oEvent) {
				this.TCNumber = oEvent.getParameter("arguments").TCNumber;
				this.Type = oEvent.getParameter("arguments").Type;
				this.getModel().metadataLoaded().then( function() {
					if(this.Type && !this.TCNumber){
						this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer2"));
						this.byId("navCon").to(this.byId("p1"));
						var that = this;
						this.byId("offerId").onsapenter = function(e) {
					        that.byId("openOfferButton").firePress();
					    };
					}else if(this.TCNumber){
						this.getView().bindElement({ 
							path: "/offerHeaderSet('" + this.TCNumber + "')",
							events: { dataReceived: this.dataReceived.bind(this) }
						});
						this.setInput(["uploadDownload", "uploadDelete", "uploadHbox", "uploadButton"], true, "Visible");
						if(this.Type === "Copy"){
							this.byId("offerTitle").setText(this.getResourceBundle().getText("copyOffer", [this.TCNumber]));
						}else{
							this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer", [this.TCNumber]));
							this.byId("tableApprove").setEnabled(true);
						}
						// Disable save buttons and enable approve if no changes(on init)
						this.setInput(["saveOffer2", "saveOffer1"], false, "Enabled");
						this.byId("tableApprove").setEnabled(true);
					}else{
						this.byId("creationDate").setDateValue(new Date());
						this.byId("trader").setSelectedKey(sap.ushell.Container.getService("UserInfo").getUser().getId());
						this.byId("createdBy").setSelectedKey(sap.ushell.Container.getService("UserInfo").getUser().getId());
						this.setInput(["uploadDownload", "uploadDelete", "uploadButton"], false, "Visible");
					}
				}.bind(this));
			},
			
			onChangeData: function(){
				if(!this.isChanged){
					this.setInput(["saveOffer2", "saveOffer1"], true, "Enabled");
					this.setInput(["tableApprove"], false, "Enabled");
					this.isChanged = true;
				}
			},
			
			// This function triggered after bind 
			// Added in Select(Product Type)
			dataReceived: function(oEvent){
				var that = this;
				if(this.TCNumber && !this.Type){
					if(oEvent.getParameters("data") && oEvent.getParameters("data").data && oEvent.getParameters("data").data.TCNumber){
						this.byId("navCon").to(this.byId("p2"));
						this.data = oEvent.getParameters("data").data;
						var status = this.data.Status;
						if(status === "1" || status === "6" || status === "7"){
							this.setEnabled(["pageOfferDetails", "parameters"], false);
							this.setInput(["saveOffer2","saveOffer1","tableApprove","volumeAddButton","volumeCopyButton","volumeDeleteButton", "uploadDownload",
								"uploadDelete", "uploadHbox"], false, "Visible");
							this.status = status;
							if(status === "7"){
								this.setInput(["saveOffer2","saveOffer1","uploadDownload","uploadDelete","uploadHbox"], true, "Visible");
								this.byId("comment").setEnabled(true);
							}
						}
						//Filter branch offices
						this.filterByType(this.data.OfferType, true);
					}
					setTimeout(function(){
						that.filterSelect();
					});
				}else if(this.TCNumber && this.Type){
					this.byId("creationDate").setDateValue(new Date());
					this.byId("trader").setSelectedKey(sap.ushell.Container.getService("UserInfo").getUser().getId());
					this.byId("createdBy").setValue(sap.ushell.Container.getService("UserInfo").getUser().getId());
					this.byId("TCNumber").setValue("$$00000001");
					if(this.Type === "Copy"){
						this.byId("status").setSelectedKey("");
						this.filterSelect();
					}
				}
			},
			
			// Main save offer function, also runned for creating and saving existing offer
			saveOffer: function(oEvent){
				if(this.status && this.status === "7"){
					var oFuncParams = { 
						TCNumber: this.TCNumber,
						TextID: "ZCMD",
						TextLine: this.byId("comment").getValue()
					};
					this.getModel().callFunction("/ChangeOfferTexts", {
						method: "POST",
						urlParameters: oFuncParams,
						success: this.onApproveSuccess.bind(this, "ChangeOfferTexts")
					});
				}else{
					var button = oEvent.getSource();
					var objectsArr = button.data("blocks").split(',');
					var offerData = this.getData(objectsArr, true);
					var volumeDataAndCheck = this.getVolumeData(true);
					var bCheckAlert = this.checkKeys(["pageOfferDetails"]);
					
					// if Mode is copy then clear TCPositions
					if(this.TCNumber && this.Type === "Copy"){
						for(var i = 0; i < volumeDataAndCheck.data.ToOfferVolume.length; i++){
							for(var j = 0; j < volumeDataAndCheck.data.ToOfferVolume[i].ToOfferPeriod.length; j++){
								var period = volumeDataAndCheck.data.ToOfferVolume[i].ToOfferPeriod[j];
								period.TCPosition = "";
							}
						}
					}
					
					if(volumeDataAndCheck.check || bCheckAlert){
						var msg = this.getResourceBundle().getText("plsEnter") + " ";
						if(volumeDataAndCheck.check && bCheckAlert){
							msg = msg + volumeDataAndCheck.check.slice(0,-4) + " " + bCheckAlert.slice(0, -2);
						}else if(volumeDataAndCheck.check){
							msg = msg + volumeDataAndCheck.check.slice(0,-4);
						}else{
							msg = msg + bCheckAlert.slice(0, -2);
						}
						this.alert(msg);
					}else{
						this.setInput(["saveOffer1","saveOffer2"], false, "Enabled");
						var model = button.getModel();
						var allData = this.mergeObjects(offerData,volumeDataAndCheck.data);
						var uploader = this.byId("upload");
						var settings = {};
						var msg = ''; 
						var that = this;
						if(allData.TCNumber === "$$00000001"){
							msg = that.getResourceBundle().getText("offerCreated");
						}else{
							msg = this.getResourceBundle().getText("offerSaved");
						}
						console.log(allData);
						settings.success = function(response){
							that.alert(msg + " " + response.TCNumber, {
								actions: [sap.m.MessageBox.Action.CLOSE],
								onClose: function(sAction){
									that.getRouter().navTo("worklist", {
										TCNumber: response.TCNumber
									});
									
									// Disable save buttons and enable approve after save
									that.setInput(["saveOffer2", "saveOffer1"], false, "Enabled");
									that.byId("tableApprove").setEnabled(true);
									that.isChanged = false;
									that.isBlacklist = false;
									that.getModel().refresh(true);
								} 
							});
							if(uploader.getValue()){
								var uploadUrl = model.sServiceUrl + "/offerHeaderSet('" + response.TCNumber + "')/ToAttachment";
								uploader.setUploadUrl(uploadUrl);
								uploader.upload();
							}
							that.setInput(["saveOffer1","saveOffer2"], true, "Enabled");
						};
						settings.error = function(){
							that.setInput(["saveOffer1","saveOffer2"], true, "Enabled");
						};
						model.create("/offerHeaderSet", allData, settings);
					}
				}
			},
			
			// Actually opens the approve dialog
			tableApprove: function(oEvent){
				var checkArr = ["tradingPurpose", "product", "paymentMethod", "paymentTerm", "meansOfTransport"];
				var check = this.getVolumeData().check;
				for(var i = 0; i < checkArr.length; i++){
					var input = this.byId(checkArr[i]) || sap.ui.getCore().byId(checkArr[i]);
					check = check + this.checkKeysInner(input, checkArr[i]);
				}
				if(this.byId("volumesList").getItems().length === 0){
					check = check + this.getModel('i18n').getResourceBundle().getText("volume") + ", ";
				}
				if(check || this.isBlacklist){
					if(check){
						check = this.getResourceBundle().getText("plsFillIn") + " \n\n " + check.slice(0,-2);
						if(this.isBlacklist){
							check = check + "\n" + this.getResourceBundle().getText("counterpartyBlacklisted");
						}
					}else{
						check = this.getResourceBundle().getText("counterpartyBlacklisted");
					}
					this.alert(check);
					return true;
				}else{
					var id = oEvent.getSource().data("id");
					sap.ui.getCore().byId(id + "Upload").selectAll();
					sap.ui.getCore().byId("approvalValidityTimeZone").setSelectedKey("UTC" + (new Date().getTimezoneOffset() / 60));
					this[id + "Dialog"].open();
				}
			},
			
			// Event on selection of table items
			onTableSelect: function(oEvent) {
				var table = oEvent.getSource();
				var selectedCount = table.getSelectedItems().length;
				var id = table.data("id");
				var select = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
				if (selectedCount > 0) {
					select.setEnabled(true);
				}else{
					select.setEnabled(false);
				}
			},
			
			// Dialog functions
			dialogCancel: function(oEvent) {
				var id = oEvent.getSource().data("id");
				this[id + "Dialog"].close();
			},
			dialogSelect: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var key = button.data("key");
				var dynamicId = button.data("dynamicId");
				var valueHelp = dynamicId ? sap.ui.getCore().byId(dynamicId) : this.byId(id + "ValueHelp") || sap.ui.getCore().byId(id + "ValueHelp");
				var items = sap.ui.getCore().byId(id).getSelectedItems();
				if(id === "counterpartyPopup"){
					var tokens = valueHelp.getTokens();
					var tokenKeys = [];
					var newTokens = tokens.slice();
					for(var i = 0; i < newTokens.length; i++){
						tokenKeys.push(newTokens[i].getKey());
					}	
				}
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					var path = item.getBindingContextPath();
					var data = item.getModel().getData(path);
					if(id === "counterpartyPopup"){
						if(tokenKeys.indexOf(data.Code) === -1){
							var token = new sap.m.Token({
								key: data.Code,
								text: data.Name
							});
							newTokens.push(token);
						}
					}else{
						var value = data.hasOwnProperty("Name") && !(id === "currencyPopup" || id === "volumeUomPopup" ) ? data.Name : data[key];
						valueHelp.data("data", data[key]);
						valueHelp.setValue(value);
						this.onChangeData();
						if(id === "portPopup" && data.SanctionCountry){
							// this.checkPorts(data.SanctionCountry);
						}
					}
				}
				if(id === "counterpartyPopup"){
					valueHelp.setTokens(newTokens);
					this.byId("counterpartyOne").setValue(newTokens[0].Code);
					if(newTokens.length > 3){
						this.alert(this.getResourceBundle().getText("plsSelect3"));
						return true;
					}else{
						if(tokens.length !== newTokens.length){
							this.getRisks(valueHelp);
							this.checkLimits();
							this.onChangeData();
						}
					}
				}
				this[id + "Dialog"].close();
			},
			dialogApprove: function(oEvent){
				var validityDate = sap.ui.getCore().byId("approvalValidityDateTime").getDateValue();
				if(validityDate && validityDate instanceof Date){
					validityDate.setMinutes(validityDate.getMinutes() + (-validityDate.getTimezoneOffset()));
					var uploadItems = sap.ui.getCore().byId("approveUpload").getSelectedItems();
					var attachList = '';
					for(var i = 0; i < uploadItems.length; i++){
						attachList = attachList + this.getModel().getData(uploadItems[i].getBindingContextPath()).FileGUID + ";";
					}
					attachList = attachList.slice(0,-1);
					
					// Consider selected date as UTC date
					
					var oFuncParams = { 
						TCNumber: this.TCNumber,
						Comment: sap.ui.getCore().byId("approveComment").getValue(),
						ValidityDate: validityDate,
						ValidityTimeZone: sap.ui.getCore().byId("approvalValidityTimeZone").getSelectedKey(),
						AttachList: attachList,
						GlobalTrader: sap.ui.getCore().byId("approveTrader").getSelectedKey()
					};
					this.getModel().callFunction("/SentOfferToApproval", {
						method: "POST",
						urlParameters: oFuncParams,
						success: this.onApproveSuccess.bind(this, "SentOfferToApproval")
					});
				}else{
					this.alert(this.getResourceBundle().getText("plsEnter") + " " + this.getResourceBundle().getText("validityDate"));
				}
			},
			onApproveSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
					this.getModel().refresh(true);
					this.approveDialog.close();
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			// Get Risks on select of Counterparties
			getRisks: function(valueHelp, removedKeys){
				var tokens = valueHelp.getTokens();
				var risks = this.byId("risks");
				risks.removeAllItems();
				var filters = [];
				for(var i = 0; i < tokens.length; i++){
					var key = tokens[i].getKey();
					if(removedKeys){
						if(removedKeys.indexOf(key) === -1){
							filters.push(new Filter({path: "Code", operator: FilterOperator.EQ, value1: key }));
						}
					}else{
						filters.push(new Filter({path: "Code", operator: FilterOperator.EQ, value1: key }));
					}
				}
				if(filters.length > 0){
					var partnersFilter = new Filter({ filters: filters, and: false });
					var tcnumberFilter = new Filter({path: "TCNumber", operator: FilterOperator.EQ, value1: this.byId("TCNumber").getValue() });
					var allFilters = new Filter({ filters: [ partnersFilter, tcnumberFilter ], and: true });
					risks.bindItems({
						path: "/offerCounterpartySet", 
						filters: allFilters, 
						template: risks['mBindingInfos'].items.template.clone()
					});
				}
			},
			
			// On multi input tokens remove
			onMultiUpdate: function(oEvent){
				var input = oEvent.getSource();
				var removedTokens = oEvent.getParameters("removedTokens").removedTokens;
				var removedTokensKeys = [];
				for(var i = 0; i < removedTokens.length; i++){
					removedTokensKeys.push(removedTokens[i].getKey());
				}
				this.getRisks(input, removedTokensKeys);
				this.onChangeData();
				this.checkLimits();
			},
			
			// Next page function
			nextPage: function(oEvent){
				var button = oEvent.getSource();
				var navCon = this.byId("navCon");
				var next = button.data("next");
				if(button.data("check")){
					var page = this.byId(button.data("id"));
					var bCheckAlert = this.checkKeys(page);
					if(bCheckAlert){
						var msg = this.getModel('i18n').getResourceBundle().getText("plsEnter") + " " + bCheckAlert.slice(0, -2);
						this.alert(msg);
						return true;
					}
				}
				if(next){
					if(button.data("edit")){
						var input = this.byId("offerId");
						var TCNumber = input.data("data") ? input.data("data") : input.getValue();
						this.getRouter().navTo("worklist", {
							TCNumber: TCNumber 
						});
					}else{
						navCon.to(this.byId(next));
					}
				}else{
					navCon.back();
				}
			},
			
			onListSelect: function(oEvent){
				var list = oEvent.getSource();
				var toolbar = list.getHeaderToolbar().getContent();
				if(list.getSelectedItems().length > 0){
					this.setInput([toolbar[3], toolbar[4]], true, "Enabled");
				}else{
					this.setInput([toolbar[3], toolbar[4]], false, "Enabled");
				}
			},
			
			// Panel functions
			add: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var list = button.getParent().getParent();
				var fragmentClone = this[id].clone();
				this.getView().addDependent(fragmentClone);
				if(id === "volumes"){
					var title = fragmentClone.getHeaderToolbar().getContent()[0];
					var titleValue = fragmentClone.getHeaderToolbar().getContent()[2];
					var length = list.getItems().length + 1 + this.deleteCounter;
					length = length < 10 ? '0' + length : length;
					title.setText(length + " / " + this.getResourceBundle().getText("fixed"));
					titleValue.setValue(length);
				}
				var newItem = new sap.m.CustomListItem();
				newItem.addContent(fragmentClone);
				if(length){
					newItem.data("number", length);
				}
				list.addItem(newItem);
				this.onChangeData();
			},
			copy: function(oEvent){
				var button = oEvent.getSource();
				var list = button.getParent().getParent();
				var selectedItem = list.getSelectedItem();
				if(selectedItem){
					var id = button.data("id");
					var clone = selectedItem.clone();
					this.getView().addDependent(clone);
					if(id === "volumes"){
						var title = clone.getContent()[0].getHeaderToolbar().getContent()[0];
						var titleValue = clone.getContent()[0].getHeaderToolbar().getContent()[2];
						var length = list.getItems().length + 1;
						if(length < 10){
							title.setText('0' + length + " / " + this.getResourceBundle().getText("fixed"));
							titleValue.setValue('0' + length);
						}else{
							title.setText(length + " / " + this.getResourceBundle().getText("fixed"));
							titleValue.setValue(length);
						}
						// Nullifying TCPositions in copied volume
						var periodList = clone.getContent()[0].getContent()[1];
						periodList.attachEventOnce("updateFinished", function(e){
							var periods = periodList.getItems();
							for(var i = 0; i < periods.length; i++){
								var TCPosition = periods[i].getContent()[0].getContent()[0].getItems()[0];
								TCPosition.setValue("");
							}
						}, this);
					}
					if(id === "periodsPrices"){
						var TCPosition = clone.getContent()[0].getContent()[0].getItems()[0];
						TCPosition.setValue("");
					}
					list.addItem(clone);
					list.fireUpdateFinished();
				}
				this.onChangeData();
				this.checkLimits();
			},
			delete: function(oEvent){
				var button = oEvent.getSource();
				var list = button.getParent().getParent();
				var selectedItems = list.getSelectedItems();
				if(selectedItems.length > 0){
					var that = this;
					MessageBox.confirm(that.getResourceBundle().getText("askDelete"), {
						actions: [that.getResourceBundle().getText("delete"), sap.m.MessageBox.Action.CLOSE],
						onClose: function(sAction) {
							if (sAction === that.getResourceBundle().getText("delete")) {
								for(var i=0; i<selectedItems.length; i++){
									list.removeItem(selectedItems[i]);
								}
								that.deleteCounter++;
								that.onChangeData();
							} else {
								MessageToast.show("Delete canceled!");
							}
						}
					});
				}
			},
			
			// Enable/Disables inputs depending flag arg
			// idArr can be array of strings as well as objects
			setInput: function(idArr, flag, func){
				var evalStr = 'input.set' + func + '(flag)';
				for(var i = 0; i < idArr.length; i++){
					var input = null;
					if(typeof idArr[i] === "string"){
						input = this.byId(idArr[i]) || sap.ui.getCore().byId(idArr[i]);
					}else if(typeof idArr[i] === "object"){
						input = idArr[i];
					}
					if(input){
						eval(evalStr);
					}
				}
			},
		
			// Checks the key inputs for empty values for dialog Add/Edit
			checkKeys: function(object){
				var check = "";
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							var vboxInput = vboxes[j].getItems()[1];
							if(vboxInput.data("key")){
								check = check + this.checkKeysInner(vboxInput);
							}
						}
					}else{
						if(input.data("key")){
							check = check + this.checkKeysInner(input);
						}
					}
				}
				return check;
			},
			// Created to check hboxes too
			checkKeysInner: function(input, id){
				var check = "";
				if((input["mProperties"].hasOwnProperty("value") && !input.getValue() && !input.hasOwnProperty("_tokenizer")) || 
				(input["mProperties"].hasOwnProperty("selectedKey") && !input.getSelectedKey() && !input.hasOwnProperty("_tokenizer")) ||
				(input.hasOwnProperty("_tokenizer") && input.getTokens().length === 0) ||
				(input.hasOwnProperty("_oMaxDate") && !input.getDateValue())){
					var textId = input.data("key") ? input.data("key") : id;
					check = check + " " + this.getModel('i18n').getResourceBundle().getText(textId) + ", ";
				}
				return check;
			},
		
			// Set odata from any dialog, argument object = any object / return object inputs Data
			getData: function(object, isSave){
				var oData = {};
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							oData = this.mergeObjects(oData, this.getDataInner(vboxes[j].getItems()[1], isSave));
						}
					}else{
						oData = this.mergeObjects(oData, this.getDataInner(input, isSave));
					}
				}
				return oData;
			},
			getDataInner: function(input, isSave){
				var oData = {};
				for(var j = 0; j < this.typeArr.length; j++){
					var type = this.typeArr[j];
					if(input.getBindingInfo(type) && !input.data("omit")){
						var value;
						if(type === "tokens"){
							var tokens = input.getTokens();
							value = [];
							for(var l = 0; l < tokens.length; l++){
								var token = {};
								token.Name = tokens[l].getText();
								token.Code = tokens[l].getKey();
								value.push(token);
							}
						}else{
							value = input.getProperty(type);
						}
						if(input.data("data") && type !== "tokens"){
							value = input.data("data");
						}
						
						var name = input.getBindingInfo(type).binding.sPath;
						
						// Set default value(placeholder) if value is not defined
						if(!value && input["mProperties"].hasOwnProperty("placeholder")){
							value = input["mProperties"].placeholder;
						}
						
						if(input.data("string")){
							value = value.toString();
						}
						
						// If inputs name is not defined
						if(input.data("name")){
							name = input.data("name");
						}
						
						// Remove offset for dates
						if(input.hasOwnProperty("_oMaxDate")){
							value = input.getDateValue();
							if(value) {
								if(isSave){
									value.setMinutes(-value.getTimezoneOffset());
								}
							} else { 
								value = null;
							}
						}
						oData[name] = value;
						
						// Bind for each input event for change
						input.attachChange(this.onChangeData, this);
					}
				}
				return oData;
			},
			
			checkValue: function(oEvent){
				var input = oEvent.getSource();
				var maxValue = input.data("max") ? parseInt(input) : 100;
				var value = parseInt(oEvent.getParameter('newValue'));
				var valueState = isNaN(value) ? "Error" : value > maxValue ? "Error" : "Success";
				input.setValueState(valueState);
			},
			
			onSwitch: function(oEvent){
				var Switch = oEvent.getSource();
				var type = Switch.data("type");
				var state = oEvent.getParameter("state");
				Switch.getParent().getParent().getItems()[1].setVisible(state).getItems()[1].setSelectedKey("").setValue("");
				if(Switch.data("switch")){
					Switch.getParent().getParent().getItems()[2].setVisible(!state).getItems()[1].setSelectedKey("").setValue("");
				}
				if(type && type === "volumes"){
					var title = Switch.getParent().getParent().getParent().getParent().getHeaderToolbar().getContent()[0];
					var newText = state ? title.getText().substring(0,5) + this.getResourceBundle().getText("optional") : 
						title.getText().substring(0,5) + this.getResourceBundle().getText("fixed");
					title.setText(newText);
				}
			},

			handleSuggest: function(oEvent) {
				var input = oEvent.getSource();
				var sTerm = oEvent.getParameter("suggestValue");
				var filterName = input.data("select") ? input.data("select") : "Name";
				var customParameter = input.data("customParameter");
				var customSet = input.data("set");
				
				if(filterName.indexOf(';') > -1){
					var filtersArr = filterName.split(';');
				}
				var isAnd = false;
				var aFilters = [];
				if (sTerm) {
					if(filtersArr){
						for(var i = 0; i < filtersArr.length; i++){
							aFilters.push(new Filter(filtersArr[i], sap.ui.model.FilterOperator.Contains, sTerm));
						}
					}else{
						aFilters.push(new Filter(filterName, sap.ui.model.FilterOperator.Contains, sTerm));
					}
				}
				var filter = new Filter({filters: aFilters, and: isAnd});
				
				if(customParameter){
					var customInput = this.byId(customParameter) || sap.ui.getCore(customParameter);
					var customValue = customInput.getSelectedKey();
					if(input.getBinding("suggestionItems").sCustomParams !== customParameter + "=" + customValue){
						var parameters = {};
						parameters.custom = {};
						parameters.custom[customParameter] = customValue;
						input.bindAggregation("suggestionItems", {
							path: "/" + customSet + "Set",
							template: input['mBindingInfos'].suggestionItems.template.clone(),
							parameters: parameters,
							filters: filter
						});
					}
				}else{
					input.getBinding("suggestionItems").filter(filter);
				}
				
			},
			suggestionItemSelected: function(oEvent){
				var valueHelp = oEvent.getSource();
				var item = oEvent.getParameters("selectedItem");
				if(item && item.selectedItem){
					valueHelp.setValue(item.selectedItem.getText()).data("data", item.selectedItem.getKey());
				}
				valueHelp.fireChange();
			},
			
			// Gete inputs from array of ids or directly from object
			getInputs: function(object){
				var inputs = [];
				if(Array.isArray(object)){
					for(var i = 0; i < object.length; i++){
						var obj = this.byId(object[i]) || sap.ui.getCore().byId(object[i]);
						var objInputs = obj.getAggregation("content") || obj.getAggregation("items");
						inputs = inputs.concat(objInputs);
					}
				}else{
					inputs = object.getAggregation("content") || object.getAggregation("items");
				}
				return inputs;
			},
			
			getVolumeData: function(isSave){
				var oData = {};
				oData.data = {};
				oData.check = "";
				var list = this.byId("volumesList");
				var volumes = list.getItems();
				oData.data.ToOfferVolume = [];
				for(var i = 0; i < volumes.length; i++){
					var volumeName = this.getData(volumes[i].getContent()[0].getHeaderToolbar(), isSave);
					var volumeData = this.getData(volumes[i].getContent()[0].getContent()[0], isSave);
					var allVolumeData = this.mergeObjects(volumeName, volumeData);
					
					var volumeCheck = this.checkDataInner(allVolumeData, ["Incoterms", "DeliveryPoint", "FixPrice"]);
					if(volumeCheck){
						oData.check = oData.check + volumeCheck + ", ";
					}
					if(allVolumeData.VolumeType){
						var volumeTypeCheck = this.checkDataInner(allVolumeData, ["VolumeOwner"]);
						if(volumeTypeCheck){
							oData.check = oData.check + volumeTypeCheck + ", ";
						}
					}
					if(allVolumeData.PriceType){
						var volumeIndexFormula = this.checkDataInner(allVolumeData, ["IndexFormula"]);
						if(volumeIndexFormula){
							oData.check = oData.check + this.getResourceBundle().getText("indexFormula") + ", ";
						}
					}else{
						var volumePriceForBase = this.checkDataInner(allVolumeData, ["OfferPriceForBase"]);
						if(volumePriceForBase){
							oData.check = oData.check + this.getResourceBundle().getText("offerPriceForBase") + ", ";
						}
					}
					
					var periods = volumes[i].getContent()[0].getContent()[1].getItems();
					if(periods.length === 0){
						if(oData.check){
							oData.check = oData.check.slice(0,-2);
						}
						oData.check = oData.check + " and Periods";
					}
					allVolumeData.ToOfferPeriod = [];
					for(var j = 0; j < periods.length; j++){
						var period = periods[j].getContent()[0].getContent()[0];
						var periodData = this.getData(period, isSave);
						allVolumeData.ToOfferPeriod.push(periodData);
						var checkPeriods = this.checkDataInner(periodData, ["DateFrom", "DateTo", "NumberOfShipments"]);
						if(checkPeriods && oData.check){
							oData.check = oData.check.slice(0,-1) + " and ";
						}
						oData.check = oData.check + checkPeriods;
						
						if(checkPeriods){
							oData.check = oData.check + " for Period " + (j + 1) + " ";
						}
					}
					oData.data.ToOfferVolume.push(allVolumeData);
					if(oData.check){
						oData.check = oData.check + " in Volume " + allVolumeData.VolumeNumber + " \n\n ";
					}
				}
				return oData;
			},
			
			onDateChange: function(oEvent){
				var dp = oEvent.getSource();
				var type = dp.data("key");
				var title = dp.getParent().getParent().getParent().getParent().getHeaderToolbar().getContent()[0];
				var volumeNumber = dp.getParent().getParent().getParent().getParent().getParent().getParent().getParent().getParent().data("number");
				var date = dp.getDateValue();
				var dp2,date2;
				if(type === "dateFrom"){
					dp2 = dp.getParent().getParent().getItems()[1].getItems()[1];
					if(dp.getDateValue() && dp2.getDateValue() && dp.getDateValue() > dp2.getDateValue()){
						this.alert(this.getResourceBundle().getText("wrongDates"));
						return true;
					}
					date2 = dp2.getDateValue();
					title.setText(volumeNumber + " / " + this.formatDate(date) + " - " + this.formatDate(date2));
				}else{
					dp2 = dp.getParent().getParent().getItems()[0].getItems()[1];
					if(dp.getDateValue() && dp2.getDateValue() && dp.getDateValue() < dp2.getDateValue()){
						this.alert(this.getResourceBundle().getText("wrongDates"));
						return true;
					}
					date2 = dp2.getDateValue();
					title.setText(volumeNumber + " / " + this.formatDate(date2) + " - " + this.formatDate(date));
				}
				this.checkLimits();
			},
			
			formatDate: function(date){
				var newDate = date ? date.toLocaleDateString("ru-RU") : "";
				return newDate;
			},
			
			// On select item in Attachments table
			onAttachmentSelect: function(e){
				var listItems = e.getParameters("listItem");
				if (listItems) {
					var id = e.getSource().data("id");
					this.setInput([id + "Delete", id + "Download"], true, "Enabled");
				}
			},
			
			// -------------------- Attachments functions --------------------
			// Triggered each time the new file was selected in fileUploader
			// Changes the fileName (slug)
			onFileChange: function(oEvent){
				var uploader = oEvent.getSource();
				var name = oEvent.getParameter("newValue");
				var uploadModel = uploader.getModel("upload");
				if(uploadModel){
					var data = uploadModel.getData();
					data.fileName = encodeURI(name);
					uploadModel.setData(data);
				}else{
					var model = this.getModel();
					var oData = { token: model.getSecurityToken(), fileName: encodeURI(name) };
					var newModel = new JSONModel(oData);
					uploader.setModel(newModel,"upload");
				}
				if(uploader.getValue()){
					this.byId("uploadButton").setEnabled(true);
				}
			},
			
			// Download function
			tableDownload: function(oEvent){
				var id = oEvent.getSource().data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getModel().sServiceUrl + table.getSelectedItem().getBindingContextPath() + "/$value";
				window.open(url);
			},
			tableDelete: function(oEvent) {
				var button = oEvent.getSource();
				var id = button.data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getSelectedItem().getBindingContextPath();
				
				// If upload table change the delete url
				if(button.data("upload")){
					url = url + "/$value";
				}
				
				var model = table.getModel();
				MessageBox.confirm("Are you sure you want to delete?", {
					actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === "Delete") {
							model.remove(url,{
								success: function(){
									
								}
							});
						} else {
							MessageToast.show("Delete canceled!");
						}
					}
				});
			},
			onFileUploaded: function(oEvent){
				var uploader = oEvent.getSource();
				uploader.setValue();
				this.byId("uploadButton").setEnabled(true);
				this.getModel().refresh(true);
			},
			upload: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var uploader = this.byId(id);
				if(uploader.getValue()){
					var model = this.getModel();
					var uploadUrl = model.sServiceUrl + "/offerHeaderSet('" + this.TCNumber + "')/ToAttachment";
					uploader.setUploadUrl(uploadUrl);
					uploader.upload();
					button.setEnabled(false);
				}
			},
			
			
			// oData = object with data, keyArr is array of keys to check
			checkDataInner: function(oData, keyArr){
				var check = "";
				for(var key in oData){
					if(keyArr.indexOf(key) > -1 ){
						if(!oData[key] || oData[key] === "0" || oData[key] === "0.00"){
							check = check + key + ",";
						}
					}
				}
				if(check){
					check = check.slice(0,-1);
				}
				return check;
			},
			
			// Filter function for selectors
			filterSelect: function(oEvent){
				var select = oEvent ? oEvent.getSource() : this.byId("productType");
				var selectedItem = select.getSelectedItem();
				if(selectedItem){
					var newValue = selectedItem.getKey();
					var filterName = select.data("filterName");
					var filterSelect = this.byId(select.data("filter"));
					var filter = new Filter(filterName, FilterOperator.EQ, newValue);
					filterSelect.getBinding("items").filter(filter);
					this.setSelectDefaultValue(newValue, filterSelect);
				}
			},
			setSelectDefaultValue: function(value, select){
				var url = this.getModel().sServiceUrl;
				$.get(url + "/defaultProductByTypeSet('" + value + "')/?$format=json", function( data ) {
					var id = data.d.Product;
					select.setSelectedKey(id);
				});
				if(!((this.data && this.data.Status === "1") || (this.data && this.data.Status === "6") || (this.data && this.data.Status === "7")) || !this.TCNumber){
					select.setEnabled(true);
				}
			},
			
			// Default alert message
			alert: function(msg, settingsArg){
				var settings = settingsArg ? settingsArg : { actions: [sap.m.MessageBox.Action.CLOSE] };
				MessageBox.alert(msg, settings);
			},
			
			// Add xml fragments to this view as dependent
			// objArr = array of string ids of objects declared on init
			addFragments: function(objArr){
				for(var i = 0; i < objArr.length; i++){
					try {
						this[objArr[i]] = sap.ui.xmlfragment("fragment." + objArr[i], this);
						this.getView().addDependent(this[objArr[i]]);
					} catch (err) {
						// Just in case if any of the dialog fragment has syntax error
						console.log("Error in dialog with ID: " + this.objArr[i] + "Dialog " + err);
					}
					
				}
			},
			
			// Object.assign doesnt work in IE so this function is created
			mergeObjects: function(objOne, objTwo){
				var objs = [objOne, objTwo],
			    result =  objs.reduce(function (r, o) {
			        Object.keys(o).forEach(function (k) {
			            r[k] = o[k];
			        });
			        return r;
			    }, {});
			    return result;
			},
			
			// Search function for all tables
			triggerSearch: function(oEvent) {
				var query = oEvent.getParameter("query") || oEvent.getParameter("selected"),
					id = oEvent.getSource().data('id'),
					key = oEvent.getSource().data('key'),
					customOperator = oEvent.getSource().data('operator'),
					oTable = this.byId(id) || sap.ui.getCore().byId(id),
					filters = [];
					
				if(!this.search[id]){ 
					this.search[id] = {};
				}
				if(typeof query !== "undefined"){
					var operator = FilterOperator.EQ;
					if(customOperator){
						operator = FilterOperator[customOperator];
					}
					this.search[id][key] = new Filter({path: key, operator: operator, value1: query });
				}else{
					delete this.search[id][key];
				}
				
				var filterKeys = Object.keys(this.search[id]);
				for(var i in filterKeys){
					filters.push(this.search[id][filterKeys[i]]);
				}
				var newFilter = new Filter({ filters: filters, and: true });
				if(filters.length === 0){
					newFilter = filters;
				}
				oTable.getBinding("items").filter(newFilter);
			},
			
			// On value help opens new dialog with filters
			handleValueHelp: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var dynamicId = button.getId();
				var filters = button.data("filters");
				var table = sap.ui.getCore().byId(id);
				var select = sap.ui.getCore().byId(id + "Select");
				var customParameter = button.data("customParameter");
				var customSet = button.data("set");
				if(customParameter){
					var customInput = this.byId(customParameter) || sap.ui.getCore(customParameter);
					for(var k = 0; k < this.typeArr.length; k++){
						var customType = this.typeArr[k]; 
						if(customInput["mProperties"].hasOwnProperty(customType)){
							var customCall = "get" + customType.charAt(0).toUpperCase() + customType.substr(1) + "()";
							var customStr = "customInput." + customCall;
							var customValue = eval(customStr);
							var parameters = {};
							parameters.custom = {};
							parameters.custom[customParameter] = customValue;
							table.bindItems({
								path: "/" + customSet +"Set",
								template: table['mBindingInfos'].items.template.clone(),
								parameters: parameters
							});
						}
					}
				}
				this.search = {}; // nullify search object
				if(filters){
					var filtersArr = filters.split(',');
					for(var i = 0; i < filtersArr.length; i++){
						for(var j = 0; j < this.typeArr.length; j++){
							var input = sap.ui.getCore().byId(id + filtersArr[i] + "Filter");
							var type = this.typeArr[j];
							if(input["mProperties"].hasOwnProperty(type)){
								input.setProperty(type);
							}
						}
					}
				}
				select.data("dynamicId", dynamicId);
				if(table.getSelectedItems().length === 0){
					select.setEnabled(false);
				}
				this[id + "Dialog"].open();
			},
			
			callRequest: function(oEvent){
				var button = oEvent.getSource();
				var type = button.data("type");
				if((type === "L" && this.isLimitsChanged) || (type === "R" && this.isRisksChanged) || (type === "B" && this.isBlacklistChanged)){
					this.alert(this.getResourceBundle().getText("plsSaveOffer"));
				}else{
					button.setEnabled(false);
					var oFuncParams = {
						TCNumber: this.byId("TCNumber").getValue(),
						RequestType: type
					};
					this.getModel().callFunction("/RequestUpdates", {
						method: "POST",
						urlParameters: oFuncParams,
						success: this.onRequestSuccess.bind(this, "RequestUpdates")
					});
				}
			},
			onRequestSuccess: function(link, oData) {
				var oResult = oData[link];
				if(oResult.RequestSuccessful){
					window.open("mailto:?subject=" + oResult.SubjectMail  + "&body=" + oResult.BodyMail);
				}else{
					MessageBox.error(oResult.Message);
				}
			},
			
			count: function(oEvent){
				var input = oEvent.getSource();
				var size = input.data("size");
				var divide = input.data("divide");
				var vboxArr = size ? input.getParent().getParent().getParent().getItems() : input.getParent().getItems();
				var shipNumber = vboxArr[3].getValue();
				var shipMin = vboxArr[4].getItems()[0].getItems()[1];
				var shipMax = vboxArr[4].getItems()[1].getItems()[1];
				var tonMin = vboxArr[6].getItems()[0].getItems()[1];
				var tonMax = vboxArr[6].getItems()[1].getItems()[1];
				if(parseFloat(shipMin.getValue()) > parseFloat(shipMax.getValue())){
					shipMin.setValueState("Warning").setValueStateText(this.getResourceBundle().getText("maxCannotBeLessMin")).setValue(shipMax.getValue());
					shipMax.setValueState("Warning").setValueStateText(this.getResourceBundle().getText("maxCannotBeLessMin"));
				}else{
					shipMin.setValueState("None");
					shipMax.setValueState("None");
				}
				if(divide){
					shipMin.setValue(Math.round(tonMin.getValue()/shipNumber));
					shipMax.setValue(Math.round(tonMax.getValue()/shipNumber));
				}else{
					tonMin.setValue(shipNumber*shipMin.getValue());
					tonMax.setValue(shipNumber*shipMax.getValue());
				}
				
				this.checkLimits();
			},
			
			setTolerance: function(oEvent){
				var input = oEvent.getSource();
				var key = input.getSelectedKey();
				var tolerance = input.getParent().getParent().getItems()[0].getItems()[1];
				if(key === "%"){
					tolerance.setMax(100);
				}else{
					tolerance.setMax(999999999999);
				}
			},
			
			collectLimitsData: function(){
				var oData = {};
				var offerData = this.getData(["pageOfferDetails","parameters"]);
				var volumeData = this.getVolumeData();
				oData.Partners = '';
				var partnersList = this.byId("counterpartyPopupValueHelp").getTokens();
				for(var i = 0; i < partnersList.length; i++){
					oData.Partners = oData.Partners + partnersList[i].getKey() + ";";
				}
				if(oData.Partners){
					oData.Partners = oData.Partners.slice(0, -1);
				}
				oData.CompanyCode = offerData.CompanyBranch;
				oData.PaymentMethod = offerData.PaymentMethod;
				oData.PaymentTerm = offerData.PaymentTerm;
				var DateFrom = null;
				var DateTo = null;
				var oneDay = 24*60*60*1000;
				var Tonnage = 0;
				for(var i = 0; i < volumeData.data.ToOfferVolume.length; i++){
					for(var j = 0; j < volumeData.data.ToOfferVolume[i].ToOfferPeriod.length; j++){
						var period = volumeData.data.ToOfferVolume[i].ToOfferPeriod[j];
						if(DateFrom){
							DateFrom = period.DateFrom < DateFrom ? period.DateFrom : DateFrom;
						}else{
							DateFrom = period.DateFrom;
						}
						if(DateTo){
							DateTo = period.DateTo > DateTo ? period.DateTo : DateTo;
						}else{
							DateTo = period.DateTo;
						}
						Tonnage = Tonnage + parseInt(period.TonnageMax);
					}
				}
				var Period = Math.round(Math.abs((DateFrom - DateTo)/(oneDay)));
				oData.Period = Period;
				oData.Tonnage = Tonnage;
				oData.TCNumber = this.byId("TCNumber").getValue();
				oData.OfferType = this.byId("type").getSelectedKey();
				return oData;
			},
			
			checkLimits: function(){
				var oFuncParams = this.collectLimitsData();
				this.getModel().callFunction("/CheckValidityLimits", {
					method: "GET",
					urlParameters: oFuncParams,
					success: this.onCheckLimitsSuccess.bind(this, "CheckValidityLimits")
				});
			},
			onCheckLimitsSuccess: function(link, oData) {
				var oResult = oData[link];
				this.byId("limitPaymentConditionIcon").setColor(oResult.PaymentExceed ? "red" : "green").setSrc(oResult.PaymentExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPeriodIcon").setColor(oResult.PeriodExceed ? "red" : "green").setSrc(oResult.PeriodExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitTonnageIcon").setColor(oResult.TonnageExceed ? "red" : "green").setSrc(oResult.TonnageExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPaymentCondition").setText(oResult.PaymentCondition ? oResult.PaymentCondition : this.getResourceBundle().getText("worklistTableTitle"));
				this.byId("limitPeriod").setText(oResult.Period + " " + oResult.PeriodUoM);
				this.byId("limitTonnage").setText(parseFloat(oResult.Tonnage).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + oResult.TonnageUoM);
				// if(oResult.PaymentExceed || oResult.PeriodExceed || oResult.TonnageExceed){
				// 	this.byId("requestLimit").setEnabled(true);
				// }else{
				// 	this.byId("requestLimit").setEnabled(false);
				// }
				if((this.status && this.status === "7") || (this.isChanged && this.TCNumber)){
					this.byId("requestLimit").setEnabled(false);
				}
			},
			
			// On Compliance Risks list update finished
			checkRisks: function(oEvent){
				var list = oEvent.getSource();
				var risks = list.getItems();
				if(risks.length > 0){
					var type = list.data("type");
					this.isRisk[type] = false;
					if(type === "other"){
						if(risks.length > 0){
							this.isRisk[type] = true;
						}
					}else if(type === "main"){
						for(var i = 0; i < risks.length; i++){
							var color = risks[i].getContent()[0].getItems()[0].getColor();
							if(color === "red" || color === "yellow"){
								this.isRisk[type] = true;
							}
						}
					}
					// if(this.isRisk.main || this.isRisk.other){
					// 	this.byId("requestRisk").setEnabled(true);
					// }else{
					// 	this.byId("requestRisk").setEnabled(false);
					// }
					if((this.status && this.status === "7") || (this.isChanged && this.TCNumber)){
						this.byId("requestRisk").setEnabled(false);
					}
				}
			},
			
			// On Compliance Risks list update finished
			checkCounterparties: function(oEvent){
				this.checkBlacklist(oEvent);
				this.checkCountries(oEvent);
			},
			
			checkBlacklist: function(oEvent){
				var list = oEvent.getSource();
				var counterparties = list.getItems();
				for(var i = 0; i < counterparties.length; i++){
					var blacklist = counterparties[i].getContent()[0].getContent()[0].getItems()[0].getItems()[1].getItems()[1].getText();
					if(blacklist === "Blacklisted"){
						this.isBlacklist = true;
					}
				}
				if(this.isBlacklist){
					this.byId("requestBlacklist").setEnabled(true);
				}else{
					this.byId("requestBlacklist").setEnabled(false);
				}
				if((this.status && this.status === "7") || (this.isChanged && this.TCNumber)){
					this.byId("requestBlacklist").setEnabled(false);
				}
			},
			
			checkCountries: function(oEvent){
				var text = this.byId("countriesSanction");
				var countries = '';
				var items = oEvent.getSource().getItems();
				for(var i = 0; i < items.length; i++){
					if(items[i].data("country")){
						countries = countries + items[i].data("country") + ",";
					}
				}
				if(countries){
					countries = countries.slice(0,-1);
					text.setText(countries).addStyleClass("red");
				}else{
					text.setText(this.getResourceBundle().getText("none")).removeStyleClass("red");
				}
			},
			
			gotoLink: function(oEvent){
				var id = oEvent.getSource().data("id");
				window.open("/sap/bc/ui2/flp#ZTS_BUSINESS_PARTNER-display&/CounterpartyHeaderSet/" + id);
			},
			
			// Sets disabled/enabled object/array inside inputs
			setEnabled: function(objArr, flag){
				var inputs = this.getInputs(objArr);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							this.setEnabledInner(vboxes[j].getItems()[1], flag);
						}
					}else{
						this.setEnabledInner(input, flag);
					}
					
				}
			},
			
			setEnabledInner: function(input, flag){
				for(var i = 0; i < this.typeArr.length; i++){
					if(input["mBindingInfos"].hasOwnProperty(this.typeArr[i]) || input.hasOwnProperty("_tokenizer")){
						input.setEnabled(flag);
					}
				}
			},
			
			onVolumesPeriodsLoaded: function(oEvent){
				// Set Disabled volumes and periods if status is defined as 1, 6 or 7
				var flag = this.status ? false : true;
				var mode = this.status ? "None" : "SingleSelectMaster";
				var list = oEvent.getSource();
				var volumes = list.getItems();
				var id = list.data("id");
				list.setMode(mode);
				for(var i = 0; i < volumes.length; i++){
					this.setEnabled(volumes[i].getContent()[0].getContent()[0], flag);
					if(id === "volume"){
						var toolbar = volumes[i].getContent()[0].getContent()[1].getHeaderToolbar().getContent();
						for(var j = 0; j < toolbar.length; j++){
							toolbar[j].setVisible(flag);
						}
					}
				}
				
				// Call get data functions to bind each input the onChangeData event function
				if(oEvent.getParameters("reason").reason === "Refresh" && oEvent.getSource().data("id") === "period"){
					this.getData(["pageOfferDetails", "parameters"]);
					this.getVolumeData();
					this.checkLimits();
				}
			},
			
			onChangeType: function(oEvent){
				var offerType = oEvent.getSource().getSelectedKey();
				if(offerType === "ZPO1"){
					this.setInput(["purchaseGroup", "purchaseGroupLabel"], true, "Visible");
					this.byId("parametersPanel").setExpanded(true);
				}else{
					this.setInput(["purchaseGroup", "purchaseGroupLabel"], false, "Visible");
				}
				this.byId("counterpartyPopupValueHelp").removeAllTokens();
				if(this.byId("risks").getItems().length > 0){
					this.byId("risks").removeAllItems();
				}
				this.filterByType(offerType);
				this.checkLimits();
			},
			
			filterByType: function(offerType, isCompany){
				var companyBranch = this.byId("companyBranch");
				companyBranch.bindItems({
					path: "/dictionaryCompanyBranchSet",
					template: companyBranch['mBindingInfos'].items.template.clone(),
					parameters: { custom: { OfferType: offerType } }
				});
				if(!isCompany){
					var counterpartyPopup = sap.ui.getCore().byId("counterpartyPopup");
					var counterpartyValueHelp = this.byId("counterpartyPopupValueHelp");
					counterpartyPopup.bindItems({
						path: "/offerCounterpartySet",
						template: counterpartyPopup['mBindingInfos'].items.template.clone(),
						parameters: { custom: { OfferType: offerType } }
					});
					counterpartyValueHelp.bindAggregation("suggestionItems", {
						path: "/offerCounterpartySet",
						template: counterpartyValueHelp['mBindingInfos'].suggestionItems.template.clone(),
						parameters: { custom: { OfferType: offerType } }
					});
				}
			},
			
			checkPorts: function(country){
				var countriesInput = this.byId("countriesSanction");
				var countries = countriesInput.getText();
				if(countries !== "None"){
					var newCountries = "";
					var countriesArr = countries.split(',');
					for(var i = 0; i < countriesArr.length; i++){
						if(countriesArr[i].indexOf(country) === -1){
							newCountries = newCountries + countriesArr[i] + ",";
						}
						newCountries = newCountries + country;
					}
					countriesInput.setText(newCountries);
				}else{
					countriesInput.setText(country);
				}
			}
		});
	}
);