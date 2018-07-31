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
				this.typeArr = ["value", "dateValue", "selectedKey", "selected"];
				
				// Add dialogs
				this.tableArr = [ "dictionaryBPInt", "portPopup", "volume", "period", "price" ];
				this.addDialogs(this.tableArr);
			},
			
			// Search function for all tables
			triggerSearch: function(oEvent) {
				var query = oEvent.getParameter("query") || oEvent.getSource().getProperty("selectedKey") || oEvent.getParameter("selected"),
					id = oEvent.getSource().data('id'),
					key = oEvent.getSource().data('key'),
					customOperator = oEvent.getSource().data('operator'),
					oTable = this.byId(id) || sap.ui.getCore().byId(id),
					filters = [];
					
				if(!this.search[id]){ 
					this.search[id] = {};
				}
				if(typeof query !== "undefined"){
					var operator = FilterOperator.Contains;
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
				var bindSet = button.data("set") ? "/" + button.data("set") + 'Set' : "/" + id + 'Set';
				var filters = button.data("filters");
				var table = sap.ui.getCore().byId(id);
				table.bindItems({
					path: bindSet,
					template: table['mBindingInfos'].items.template
				});
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
				var selectButton = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
				selectButton.data("dynamicId", dynamicId);
				
				this[id + "Dialog"].getButtons()[1].setEnabled(false);
				this[id + "Dialog"].open();
			},
			
			// Add all dialog xml fragments to this view as dependent
			// Arguments: tableArr = array of string ids of tables declared on init
			addDialogs: function(tableArr){
				for(var i = 0; i < tableArr.length; i++){
					// Just in case if any of the dialog fragment has syntax error
					try {
						this[tableArr[i] + "Dialog"] = sap.ui.xmlfragment("fragment." + tableArr[i] + "Dialog", this);
						this.getView().addDependent(this[tableArr[i] + "Dialog"]);
					} catch (err) {
						console.log("Error in dialog with ID: " + this.tableArr[i] + "Dialog");
					}
					
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
				var valueHelp = this.byId(dynamicId) || sap.ui.getCore().byId(dynamicId);
				var items = sap.ui.getCore().byId(id).getSelectedItems();
				if(id === "dictionaryBPInt"){
					var vboxCounterparty = this.byId("vboxBlacklistCounterparty");
					var vboxStatus = this.byId("vboxBlacklistStatus");
					vboxCounterparty.removeAllItems();
					vboxStatus.removeAllItems();
				}
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					var path = item.getBindingContextPath();
					var data = item.getModel().getData(path);
					if(id === "portPopup" || id === "dictionaryBPInt"){
						var token = new sap.m.Token({
							key: data.Code,
							text: data.Name
						});
						valueHelp.addToken(token);
					}else{
						valueHelp.setValue(data[key]);
					}
					if(id === "dictionaryBPInt"){
						var random_boolean = Math.random() >= 0.5;
						var status = random_boolean ? this.getModel('i18n').getResourceBundle().getText("blacklisted") : this.getModel('i18n').getResourceBundle().getText("notBlacklisted");
						
						var counterpartyText = new sap.m.Text({
							text: data.Name
						});
						var statusText = new sap.m.Text({
							text: status
						});
						if(random_boolean){
							counterpartyText.addStyleClass("red");
							statusText.addStyleClass("red");
						}
						counterpartyText.addStyleClass("smallMarginBottom");
						vboxCounterparty.addItem(counterpartyText);
						
						statusText.addStyleClass("smallMarginBottom");
						vboxStatus.addItem(statusText);
					}
				}
				this[id + "Dialog"].close();
			},
			dialogAdd: function(oEvent) {
				var button = oEvent.getSource();
				var id = button.data("id");
				var dialog = button.getParent();
				var oModel = dialog.getModel();
				var oData = this.getOdata(dialog);
				var bCheckAlert = this.checkKeys(dialog);
				
				if(!bCheckAlert){
					oModel.create("/" + id + "Set", oData);
					this[id + "Dialog"].close();
				}else{
					var msg = this.getModel('i18n').getResourceBundle().getText("plsEnter") + " " + bCheckAlert.slice(0, -2);
					MessageBox.alert(msg, {
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
				}
			},
			dialogSave: function(oEvent) {
				var id = oEvent.getSource().data("id");
				var dialog = sap.ui.getCore().byId(id + "Dialog");
				var url = dialog.getBindingContext().getPath();
				var oModel = dialog.getModel();
				var oData = this.getOdata(dialog);
				dialog.unbindElement();
				oModel.update(url, oData);
				dialog.close();
			},
			
			nextPage: function(oEvent){
				var button = oEvent.getSource();
				var navCon = this.byId("navCon");
				var id = button.data("next");
				if(button.data("check")){
					var page = this.byId(button.data("id"));
					var bCheckAlert = this.checkKeys(page);
					if(bCheckAlert){
						var msg = this.getModel('i18n').getResourceBundle().getText("plsEnter") + " " + bCheckAlert.slice(0, -2);
						MessageBox.alert(msg, {
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						return true;
					}
				}
				if(id){
					navCon.to(this.byId(id));
				}else{
					navCon.back();
				}
			},
			
			onCheckBoxSelect: function(oEvent){
				var checkBox = oEvent.getSource();
				var selectedItem = checkBox.getParent().getParent().getParent();
				var list = selectedItem.getParent();
				var items = list.getItems();
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					if(item._active){
						var prevCheckBox = item.getContent()[0].getHeaderToolbar().getContent()[2];
						prevCheckBox.setSelected(false);
						item.setActive(false);
					}
				}
				selectedItem.setActive(checkBox.getSelected());
				list.fireSelectionChange();
			},
			onListSelect: function(oEvent){
				var list = oEvent.getSource();
				var items = list.getItems();
				var item = false;
				var toolbarContent = list.getHeaderToolbar().getContent();
				for(var i = 0; i < items.length; i++){
					if(items[i]._active){
						item = items[i];
					}
				}
				if(item){
					this.setInput([toolbarContent[3], toolbarContent[4], toolbarContent[5]], true, "Enabled");
				}else{
					this.setInput([toolbarContent[3], toolbarContent[4], toolbarContent[5]], false, "Enabled");
				}
			},
			
			// Panel functions
			add: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var dialog = this[id + "Dialog"];
				var dialogButtons = dialog.getButtons();
				this.setEnabledDialog(dialog, true, true);
				dialog.unbindElement();
				dialogButtons[1].setVisible(true);
				dialogButtons[2].setVisible(false);
				dialog.open();
			},
			edit: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var dialog = this[id + "Dialog"];
				var dialogButtons = dialog.getButtons();
				dialog.unbindElement();
				dialogButtons[1].setVisible(false);
				dialogButtons[2].setVisible(true);
				dialog.open();
			},
			delete: function(oEvent){
				var button = oEvent.getSource();
				var items = button.getParent().getParent().getItems();
				var item = null;
				for(var i = 0; i < items.length; i++){
					if(items[i]._active){
						item = items[i];
					}
				}
				if(item){
					var url = item.getBindingContextPath();
					var oModel = item.getModel();
					var that = this;
					MessageBox.confirm(that.getResourceBundle().getText("askDelete"), {
						actions: [that.getResourceBundle().getText("delete"), sap.m.MessageBox.Action.CLOSE],
						onClose: function(sAction) {
							if (sAction === that.getResourceBundle().getText("delete")) {
								oModel.remove(url);
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
			
			// Set key inputs as disabled/enabled for editting
			// Arguments: dialog = object dialog, flag = boolean flag for enabled/disabled
			// all = boolean set all inputs
			setEnabledDialog: function(dialog, flag, all){
				var inputs = dialog.getContent();
				for(var i = 0; i < inputs.length; i++){
					for(var j = 0; j < this.typeArr.length; j++){
						var type = this.typeArr[j];
						var input = inputs[i];
						if(input["mBindingInfos"].hasOwnProperty(type)){
							if(all){
								input.setEnabled(flag);
							}else{ 
								if(input.data("key")){
									input.setEnabled(false);
								}else{
									input.setEnabled(flag);
								}
							}
						}
					}
				}
			},
		
			// Checks the key inputs for empty values for dialog Add/Edit
			checkKeys: function(object){
				var check = "";
				var inputs = object.getAggregation("content") || object.getAggregation("items");
				for(var i = 0; i < inputs.length; i++){
					var oInput = inputs[i];
					if(oInput.data("key")){
						if((oInput["mProperties"].hasOwnProperty("value") && !oInput.getValue()) || 
						(oInput["mProperties"].hasOwnProperty("selectedKey") && !oInput.getSelectedKey()) ||
						(oInput["mProperties"].hasOwnProperty("value") && !oInput.getValue()) ||
						(oInput.hasOwnProperty("_tokenizer") && oInput.getTokens().length === 0) ||
						(oInput.hasOwnProperty("_oMaxDate") && !oInput.getDateValue())){
							check = check + " " + this.getModel('i18n').getResourceBundle().getText(oInput.data("key")) + ", ";
						}
					}
				}
				return check;
			},
		
			// Set odata from any dialog, argument object = any object / return object inputs Data
			getOdata: function(object){
				var oData = {};
				var inputs = object.getAggregation("content");
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					for(var j = 0; j < this.typeArr.length; j++){
						var type = this.typeArr[j];
						if(input.getBindingInfo(type)){
							var value = input.getProperty(type);
							var name = input.getBindingInfo(type).binding.sPath;
							
							// Set default value(placeholder) if value is not defined
							if(!value && input["mProperties"].hasOwnProperty("placeholder")){
								value = input["mProperties"].placeholder;
							}
							// if type of input is number then convert from string to number
							if(input["mProperties"].hasOwnProperty("type") && input.getType() === "Number"){
								value = parseInt(value);
							}
							// If inputs name is not defined
							if(input.data("name")){
								name = input.data("name");
							}
							// Remove offset for dates
							if(input.hasOwnProperty("_oMaxDate")){
								value = input.getDateValue();
								if(value) {
									value.setMinutes(-value.getTimezoneOffset());
								} else { 
									value = null;
								}
							}
							oData[name] = value;
						}
					}
				}
				return oData;
			},
			
			openMail: function(oEvent){
				var counterParty = oEvent.getSource().data("key");
				window.open("mailto:");
			},
			
			checkValue: function(oEvent){
				var Input = oEvent.getSource();
				var maxValue = Input.data("max") ? parseInt(input.data("max")) : 100;
				var value = parseInt(oEvent.getParameter('newValue'));
				var valueState = isNaN(value) ? "Error" : value > maxValue ? "Error" : "Success";
				Input.setValueState(valueState);
			},
			
			onSwitch: function(oEvent){
				var Switch = oEvent.getSource();
				if(Switch.data("id")){
					var id = Switch.data("id");
					var obj = this.byId(id) || sap.ui.getCore().byId(id);
					var state = oEvent.getParameter("state");
					obj.setVisible(state);
				}
			},

			handleSuggest: function(oEvent) {
				var sTerm = oEvent.getParameter("suggestValue");
				var filterName = oEvent.getSource().data("select") ? oEvent.getSource().data("select") : "Name";
				var aFilters = [];
				if (sTerm) {
					aFilters.push(new Filter(filterName, sap.ui.model.FilterOperator.StartsWith, sTerm));
				}
				oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
			}
		});
	}
);