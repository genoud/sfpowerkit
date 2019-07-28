import BaseUtils from "./baseUtils";
import { RecordType } from "./schema";
import { Org } from "@salesforce/core";
import { METADATA_INFO } from "./metadataInfo";
import _ from "lodash";

const QUERY = "Select Id, Name, DeveloperName, SobjectType from RecordType";

export default class RecordTypeUtils extends BaseUtils<RecordType> {
  private static instance: RecordTypeUtils;
  private constructor(public org: Org) {
    super(org);
    super.setQuery(QUERY);
  }

  public static getInstance(org: Org): RecordTypeUtils {
    if (!RecordTypeUtils.instance) {
      RecordTypeUtils.instance = new RecordTypeUtils(org);
    }
    return RecordTypeUtils.instance;
  }

  public async getObjects(): Promise<RecordType[]> {
    if (
      (this.data === undefined || this.data.length == 0) &&
      !this.dataLoaded
    ) {
      let objects = await super.getObjects();
      objects = objects.map(elem => {
        elem.FullName = elem.SobjectType + "." + elem.DeveloperName;
        if (
          elem.DeveloperName === "PersonAccount" &&
          elem.SobjectType === "Account"
        ) {
          elem.FullName = "PersonAccount" + "." + elem.DeveloperName;
        }
        return elem;
      });

      this.data = objects;
      this.dataLoaded = true;
    }
    return this.data
  }

  public async getrecordTypes(): Promise<RecordType[]> {
    return await this.getObjects();
  }

  public async recordTypeExists(recordType: string): Promise<boolean> {
    let found = false;
    //Look first in project files
    if (!_.isNil(METADATA_INFO.RecordType.components)) {
      found = METADATA_INFO.RecordType.components.includes(recordType);
    }
    if (!found) {
      //not found, check on the org
      let recordTypes = await this.getrecordTypes();
      let foundRecordType = recordTypes.find(rt => {
        return rt.FullName === recordType;
      });
      found = !_.isNil(foundRecordType);
    }
    return found;
  }
  
}
