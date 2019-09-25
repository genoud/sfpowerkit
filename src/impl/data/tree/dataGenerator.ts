import { Org } from "@salesforce/core";

const fs = require("fs");
const path = require("path");
import { fs as SfdxUtil } from "@salesforce/core";
import _ from "lodash";

export default class DataGenerator {
  public constructor(
    public org: Org,
    public dataStructure: any[],
    public queryFolder: string,
    public outputFolder: string
  ) {}

  public async generateData(): Promise<any> {
    var data = {};
    // var importPlanArray = [];
    for (var i = 0; i < this.dataStructure.length; i++) {
      var element = this.dataStructure[i];
      var elementRecords = await this.getDataByElement(element, data);
      data[element.sobject] = elementRecords;
    }
    if (fs.existsSync(this.outputFolder) == false) {
      fs.mkdirSync(this.outputFolder);
    }

    console.log("Building data plan");
    this.buildExportPlan(data);

    //generate one file for each type
    console.log("Writing files");
    this.generateFiles(data);
    return data;
  }

  private buildExportPlan(data) {
    var importPlanArray = [];
    for (var i = 0; i < this.dataStructure.length; i++) {
      var element = this.dataStructure[i];
      var importPlan = this.generateImportPlan(element, importPlanArray, data);
      if (!_.isNil(importPlan)) {
        importPlanArray.push(importPlan);
      }
    }
    var outputPath = path.join(this.outputFolder, "data-export-plan.json");
    SfdxUtil.writeJson(outputPath, importPlanArray);
  }
  private countRecords(objectRecords) {
    var objectArray = [];
    for (var id in objectRecords) {
      var record = objectRecords[id];
      objectArray.push(record);
    }
    return objectArray.length;
  }

  private hasParentOfSameType(sObjectType): boolean {
    var element = this.getObjectStructureDefinition(sObjectType);
    if (!element) return false;
    var parents = element.parents;
    for (var j = 0; j < parents.length; j++) {
      var parentType = parents[j].SobjectType as string;
      if (parentType === sObjectType) {
        return true;
      }
    }

    return false;
  }

  public generateFiles(data) {
    for (var sObjectType in data) {
      var objectRecords = data[sObjectType];
      var objectArray = [];
      var hasParentOfSameType = this.hasParentOfSameType(sObjectType);
      for (var id in objectRecords) {
        var record = data[sObjectType][id];
        objectArray.push(record);
      }

      if (hasParentOfSameType) {
        var element = this.getObjectStructureDefinition(sObjectType);
        var parentField = element.parents.filter(parent => {
          return parent.SobjectType === sObjectType;
        })[0].FieldName;
        var parentArray = [];
        for (var id in objectRecords) {
          var parentRecord = data[sObjectType][id];
          var parentRef = "@" + parentRecord.attributes.referenceId;
          for (var i = 0; i < objectArray.length; i++) {
            var record = objectArray[i];
            if (record[parentField] === parentRef) {
              parentArray.push(parentRecord);
              break;
            }
          }
        }
        var toSave = { records: parentArray };
        var outputPath = path.join(
          this.outputFolder,
          sObjectType + "__parent.json"
        );
        SfdxUtil.writeJson(outputPath, toSave);

        objectArray = objectArray.filter(record => {
          var isParent = false;
          for (var i = 0; i < parentArray.length; i++) {
            if (
              parentArray[i].attributes.referenceId ===
              record.attributes.referenceId
            ) {
              isParent = true;
              break;
            }
          }
          return !isParent;
        });
      }

      var toSave = { records: objectArray };
      var outputPath = path.join(this.outputFolder, sObjectType + ".json");
      SfdxUtil.writeJson(outputPath, toSave);
    }
  }

  public generateImportPlan(element, importPlanArray, data) {
    if (this.planExists(element, importPlanArray)) {
      return null;
    }
    var objectRecords = data[element.sobject];
    var counts = this.countRecords(objectRecords);
    if (counts <= 0) {
      return null;
    }

    var parents = element.parents;
    if (parents.length > 0) {
      for (var i = 0; i < parents.length; i++) {
        var parent = parents[i];
        var parentType = parent.SobjectType as string;
        var parentelement = this.getObjectStructureDefinition(parentType);
        if (!parentelement) {
          continue;
        }
        if (parentType !== element.sobject) {
          var parentPlan = this.generateImportPlan(
            parentelement,
            importPlanArray,
            data
          );
          if (!_.isNil(parentPlan)) {
            importPlanArray.push(parentPlan);
          }
        } else {
          //Generate a disting plan for parent record that will import parent before child record of same type
          var parentPlan = {
            sobject: parentelement.sobject,
            saveRefs: true,
            resolveRefs: true,
            files: [parentelement.sobject + "__parent.json"]
          };
          importPlanArray.push(parentPlan);
        }
      }
    }

    var importPlan = {
      sobject: element.sobject,
      saveRefs: true,
      resolveRefs: true,
      files: [element.sobject + ".json"]
    };
    return importPlan;
  }

  private planExists(element, importPlanArray) {
    var found = false;
    for (var i = 0; i < importPlanArray.length; i++) {
      var plan = importPlanArray[i];
      var sObjectType = plan.sobject as string;
      var elementType = element.sobject as string;
      sObjectType = sObjectType.trim().toLowerCase();
      elementType = elementType.trim().toLowerCase();
      if (sObjectType === elementType) {
        found = true;
        break;
      }
    }
    return found;
  }

  public async getParentRecords(records, parents, data): Promise<any> {
    var parentRecords = {};
    if (parents.length > 0) {
      for (var k = 0; k < parents.length; k++) {
        var parent = parents[k];
        var parentIdsToload = {};
        for (var j = 0; j < records.length; j++) {
          var record = records[j];
          var parentId = record[parent.FieldName];

          if (parentId) {
            if (
              _.isNil(data[parent.SobjectType]) ||
              (!_.isNil(data[parent.SobjectType]) &&
                _.isNil(data[parent.SobjectType][parentId]))
            ) {
              if (!parentIdsToload[parent.SobjectType]) {
                parentIdsToload[parent.SobjectType] = [];
              }
              parentIdsToload[parent.SobjectType].push(parentId);
            }
          }
        }
        var objects = Object.keys(parentIdsToload);
        for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
          //load the parent object definition
          var element = this.getObjectStructureDefinition(object);
          if (element && element != null && element != undefined) {
            parentRecords = await this.getDataByElement(
              element,
              data,
              parentIdsToload[object]
            );
            data[element.sobject] = parentRecords;
          }
        }
      }
    }
    return parentRecords;
  }

  private getObjectStructureDefinition(sobjecttype: string) {
    var foundElement = null;
    for (var i = 0; i < this.dataStructure.length; i++) {
      var element = this.dataStructure[i];
      var elementObject: string = element.sobject as string;

      elementObject = elementObject.trim();
      elementObject = elementObject.toLowerCase();

      sobjecttype = sobjecttype.trim().toLowerCase();
      if (elementObject === sobjecttype) {
        foundElement = element;
        break;
      }
    }
    return foundElement;
  }

  public async getDataByElement(element, data, ids?: string[]): Promise<any> {
    var records = [];
    if (ids && ids.length > 0) {
      records = await this.generateDatabyChildParentId(element.sobject, ids);
    } else {
      records = await this.generateDataBySobject(element.sobject);
    }

    //generate parent object here
    var parents = element.parents;
    if (parents.length > 0) {
      await this.getParentRecords(records, parents, data);
    }
    var elementRecords = {};
    if (data[element.sobject]) {
      elementRecords = data[element.sobject];
    }
    var recordCount = Object.keys(elementRecords).length;
    for (var j = 0; j < records.length; j++) {
      recordCount++;
      var record = records[j];
      var id = record.Id;
      delete record.Id;
      record.attributes = {
        type: element.sobject,
        referenceId: element.sobject + "Ref" + recordCount
      };
      //replace the parent Id value with it generated reference
      if (parents.length > 0) {
        for (var i = 0; i < parents.length; i++) {
          var parentFieldName = parents[i].FieldName;
          var parentType = parents[i].SobjectType;
          var parentRef = this.getParentReference(
            data,
            record[parentFieldName],
            parentType
          );
          if (!_.isNil(parentRef)) {
            record[parentFieldName] = "@" + parentRef;
          } else {
            delete record[parentFieldName];
          }
        }
      }
      elementRecords[id] = record;
    }
    return elementRecords;
  }

  private getParentReference(data, parentId, parentType) {
    var parentTypes = Object.keys(data);
    var parentRef = null;
    for (var i = 0; i < parentTypes.length; i++) {
      var oneParentType = parentTypes[i];
      if (oneParentType === parentType) {
        var parentData = data[parentType];
        var parentIds = Object.keys(parentData);
        for (var j = 0; j < parentIds.length; j++) {
          var oneParentId = parentIds[j];
          if (oneParentId === parentId) {
            var record = data[oneParentType][oneParentId];
            parentRef = record.attributes.referenceId;
          }
        }
      }
    }
    return parentRef;
  }

  public async generateDataBySobject(sobjectType: string): Promise<any[]> {
    console.log("Generating data for " + sobjectType);

    var queryFile = path.join(
      process.cwd(),
      this.queryFolder,
      sobjectType + ".soql"
    );
    var query = await SfdxUtil.readFile(queryFile, "utf8");

    const conn = this.org.getConnection();

    // Query the org
    const result = await conn.query<any>(query);

    //Build the array
    if (!result.records || result.records.length <= 0) {
      return [];
    }

    return result.records;
  }

  public async generateDatabyChildParentId(sobjectType: string, ids: string[]) {
    console.log("Querying parent records " + sobjectType);
    var queryFile = path.join(
      process.cwd(),
      this.queryFolder,
      sobjectType + ".soql"
    );

    var query = await SfdxUtil.readFile(queryFile, "utf8");
    const idsWithQuote = ids.map(id => "'" + id + "'");

    var idClause = idsWithQuote.join(", ");
    idClause = "Id in (" + idClause + ")";
    if (query.includes("WHERE")) {
      var queryParts = query.split("WHERE");
      queryParts = [queryParts[0], "WHERE", idClause]; //, "AND", queryParts[1]
      query = queryParts.join(" ");
    } else {
      var queryParts = query.split("FROM");
      queryParts = [queryParts[0], "FROM", sobjectType, "WHERE", idClause]; //, fromPartStr
      query = queryParts.join(" ");
    }

    const conn = this.org.getConnection();

    // Query the org
    const result = await conn.query<any>(query);

    //Build the array
    if (!result.records || result.records.length <= 0) {
      return [];
    }

    return result.records;
  }
}
