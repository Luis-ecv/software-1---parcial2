export function buildExportXML(nodes, edges) {
  // -------------------------------------------------------
  // 1) Generar los atributos de cada clase
  // -------------------------------------------------------
  function buildAttributes(nodeId, attributes) {
    if (!attributes || !attributes.length) return "";

    let attributesXML = "";
    attributes.forEach((attr, index) => {
      attributesXML += `
        <UML:Attribute name="${attr}" changeable="none" visibility="private" ownerScope="instance" targetScope="instance">
          <UML:Attribute.initialValue>
            <UML:Expression/>
          </UML:Attribute.initialValue>
          <UML:StructuralFeature.type>
            <UML:Classifier xmi.idref="eaxmiid${index}${nodeId}"/>
          </UML:StructuralFeature.type>
          <UML:ModelElement.taggedValue>
            <UML:TaggedValue tag="type" value=""/>
            <UML:TaggedValue tag="containment" value="Not Specified"/>
            <UML:TaggedValue tag="ordered" value="0"/>
            <UML:TaggedValue tag="collection" value="false"/>
            <UML:TaggedValue tag="position" value="0"/>
            <UML:TaggedValue tag="lowerBound" value="1"/>
            <UML:TaggedValue tag="upperBound" value="1"/>
            <UML:TaggedValue tag="duplicates" value="0"/>
            <UML:TaggedValue tag="ea_guid" value="{C2602A54-4A22-45f7-ABAA-4FBE30A2EF6${nodeId}${index}}"/>
            <UML:TaggedValue tag="ea_localid" value="27"/>
            <UML:TaggedValue tag="styleex" value="volatile=0;"/>
          </UML:ModelElement.taggedValue>
        </UML:Attribute>
      `;
    });

    return attributesXML;
  }

  // -------------------------------------------------------
  // 2) Generar asociaciones
  // -------------------------------------------------------
  function buildAssociationsXML(edges) {
    let associationsXML = "";

    edges.forEach((edge, i) => {
      // Determina el tipo de multiplicidad
      // y si es 'Association', 'Aggregation' o 'Composition'
      // para poner la palabra exacta en "aggregation"
      const edgeType = edge.data?.type || "Association";
      let aggregation = "none";
      if (edgeType === "Aggregation") {
        aggregation = "shared";
      } else if (edgeType === "Composition") {
        aggregation = "composite";
      }

      // Multiplicidad
      const startLabel = edge.data?.startLabel || "1";
      const endLabel   = edge.data?.endLabel   || "1";

      // Generamos la asociación
      associationsXML += `
        <UML:Association xmi.id="${edge.id}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">
          <UML:ModelElement.taggedValue>
            <UML:TaggedValue tag="style" value="3"/>
            <UML:TaggedValue tag="ea_type" value="${edgeType}"/>
            <UML:TaggedValue tag="direction" value="Unspecified"/>
            <UML:TaggedValue tag="linemode" value="3"/>
            <UML:TaggedValue tag="linecolor" value="-1"/>
            <UML:TaggedValue tag="linewidth" value="0"/>
            <UML:TaggedValue tag="seqno" value="0"/>
            <UML:TaggedValue tag="headStyle" value="0"/>
            <UML:TaggedValue tag="lineStyle" value="0"/>

            <UML:TaggedValue tag="ea_localid" value="${edge.id}-${i}"/>
            <UML:TaggedValue tag="ea_sourceName" value="Persona"/>
            <UML:TaggedValue tag="ea_targetName" value="Bicicleta"/>
            <UML:TaggedValue tag="ea_sourceType" value="Class"/>
            <UML:TaggedValue tag="ea_targetType" value="Class"/>  
            <UML:TaggedValue tag="ea_sourceID" value="nodo-${edge.source}"/>
            <UML:TaggedValue tag="ea_targetID" value="nodo-${edge.target}"/>
            <UML:TaggedValue tag="virtualInheritance" value="0"/>
            <UML:TaggedValue tag="lb" value="1"/>
            <UML:TaggedValue tag="rb" value="1"/>
          </UML:ModelElement.taggedValue>
          <UML:Association.connection>
            <UML:AssociationEnd 
              visibility="public" 
              multiplicity="${startLabel}" 
              aggregation="none "
              isOrdered="false" 
              targetScope="instance" 
              changeable="none" 
              isNavigable="true" 
              type="EAID_MYCLASS_00${edge.source}"
            >
              <UML:ModelElement.taggedValue>
                <UML:TaggedValue tag="containment" value="Unspecified"/>
                <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>
                <UML:TaggedValue tag="ea_end" value="source"/>
              </UML:ModelElement.taggedValue>
            </UML:AssociationEnd>
            <UML:AssociationEnd 
              visibility="public" 
              multiplicity="${endLabel}" 
              aggregation="${aggregation}" 
              isOrdered="false" 
              targetScope="instance" 
              changeable="none" 
              isNavigable="true" 
              type="EAID_MYCLASS_00${edge.target}"
            >
              <UML:ModelElement.taggedValue>
                <UML:TaggedValue tag="containment" value="Unspecified"/>
                <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>
                <UML:TaggedValue tag="ea_end" value="target"/>
              </UML:ModelElement.taggedValue>
            </UML:AssociationEnd>
          </UML:Association.connection>
        </UML:Association>
      `;
    });

    return associationsXML;
  }

  // -------------------------------------------------------
  // 3) Generar las clases
  // -------------------------------------------------------
  let classesXML = "";
  let diagramElementsXML = "";

  nodes.forEach((node, i) => {
    // Atributos
    const attributesXML = buildAttributes(node.id, node.data.attributes);

    // Clase
    classesXML += `
      <UML:Class 
        name="${node.data.className}" 
        xmi.id="EAID_MYCLASS_00${node.id}" 
        visibility="public"
        namespace="EAPK_8510AB1B_CCEC_4186_AAF7_EB9893025F80"
        isRoot="false"
        isLeaf="false"
        isAbstract="false"
        isActive="false"
      >
        <UML:ModelElement.taggedValue>
          <UML:TaggedValue tag="isSpecification" value="false"/>
          <UML:TaggedValue tag="ea_stype" value="Class"/>
          <UML:TaggedValue tag="ea_ntype" value="0"/>
          <UML:TaggedValue tag="version" value="1.0"/>
          <UML:TaggedValue tag="package" value="EAPK_8510AB1B_CCEC_4186_AAF7_EB9893025F80"/>
          <UML:TaggedValue tag="date_created" value="2024-10-04 05:42:51"/>
          <UML:TaggedValue tag="date_modified" value="2024-10-04 05:42:55"/>
          <UML:TaggedValue tag="gentype" value="Java"/>
          <UML:TaggedValue tag="tagged" value="0"/>
          <UML:TaggedValue tag="package_name" value="Class Model"/>
          <UML:TaggedValue tag="phase" value="1.0"/>
          <UML:TaggedValue tag="author" value="HttpRen"/>
          <UML:TaggedValue tag="complexity" value="1"/>
          <UML:TaggedValue tag="product_name" value="Java"/>
          <UML:TaggedValue tag="status" value="Proposed"/>
          <UML:TaggedValue tag="tpos" value="0"/>
          <UML:TaggedValue tag="ea_localid" value="nodo-${node.id}"/>
          <UML:TaggedValue tag="ea_eleType" value="element"/>
          <UML:TaggedValue tag="style" value="BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;"/>
        </UML:ModelElement.taggedValue>
        <UML:Classifier.feature>
          ${attributesXML}
        </UML:Classifier.feature>
      </UML:Class>
    `;

    // Elementos del diagrama (posición)
    diagramElementsXML += `
      <UML:DiagramElement 
        geometry="Left=${parseInt(node.position.x || 0)};Top=${parseInt(node.position.y || 0)};Right=${parseInt((node.position.x || 0) + 50)};Bottom=${parseInt((node.position.y || 0) + 60)};" 
        subject="EAID_MYCLASS_00${node.id}" 
        seqno="${i + 1}" 
        style="DUID=12345;"
      />
    `;
  });

  // -------------------------------------------------------
  // 4) Generar todo el bloque final (XML completo)
  //    - UML:Model con "EARootClass"
  //    - UML:Package con taggedValue
  //    - Clases + asociaciones
  //    - UML:Diagram
  // -------------------------------------------------------

  const associationsXML = buildAssociationsXML(edges);

  const xml = `<?xml version="1.0" encoding="windows-1252"?>
<XMI xmlns:UML="omg.org/UML1.3" xmi.version="1.1" timestamp="2024-10-04 05:45:18">
  <XMI.header>
    <XMI.documentation>
      <XMI.exporter>Enterprise Architect</XMI.exporter>
      <XMI.exporterVersion>2.5</XMI.exporterVersion>
    </XMI.documentation>
  </XMI.header>

  <XMI.content>
    <UML:Model name="EA Model" xmi.id="MX_EAID_8510AB1B_CCEC_4186_AAF7_EB9893025F80">
      <UML:Namespace.ownedElement>

        <UML:Class 
          name="EARootClass"
          xmi.id="EAID_11111111_5487_4080_A7F4_41526CB0AA00"
          isRoot="true"
          isLeaf="false"
          isAbstract="false"
        />

        <UML:Package 
          name="Class Model"
          xmi.id="EAPK_8510AB1B_CCEC_4186_AAF7_EB9893025F80"
          isRoot="false"
          isLeaf="false"
          isAbstract="false"
          visibility="public"
        >
          <UML:ModelElement.taggedValue>
            <UML:TaggedValue tag="parent" value="EAPK_AAD25E0C_27E3_44c2_B427_87D636B2D17C"/>
            <UML:TaggedValue tag="ea_package_id" value="86"/>
            <UML:TaggedValue tag="created" value="2024-10-04 05:42:06"/>
            <UML:TaggedValue tag="modified" value="2024-10-04 05:45:02"/>
            <UML:TaggedValue tag="iscontrolled" value="FALSE"/>
            <UML:TaggedValue tag="isnamespace" value="1"/>
            <UML:TaggedValue tag="lastloaddate" value="2024-10-04 05:42:06"/>
            <UML:TaggedValue tag="lastsavedate" value="2024-10-04 05:42:06"/>
            <UML:TaggedValue tag="isprotected" value="FALSE"/>
            <UML:TaggedValue tag="usedtd" value="FALSE"/>
            <UML:TaggedValue tag="logxml" value="FALSE"/>
            <UML:TaggedValue tag="tpos" value="6"/>
            <UML:TaggedValue tag="packageFlags" value="isModel=1;VICON=3;CRC=0;"/>
            <UML:TaggedValue tag="batchsave" value="0"/>
            <UML:TaggedValue tag="batchload" value="0"/>
            <UML:TaggedValue tag="phase" value="1.0"/>
            <UML:TaggedValue tag="status" value="Proposed"/>
            <UML:TaggedValue tag="author" value="HttpRen"/>
            <UML:TaggedValue tag="complexity" value="1"/>
            <UML:TaggedValue tag="ea_stype" value="Public"/>
            <UML:TaggedValue tag="tpos" value="6"/>
          </UML:ModelElement.taggedValue>
          
          <UML:Namespace.ownedElement>
            ${classesXML}
            ${associationsXML}
          </UML:Namespace.ownedElement>
        </UML:Package>
      </UML:Namespace.ownedElement>
    </UML:Model>
    
    <UML:Diagram
      name="Class Model"
      xmi.id="EAID_0302CD9D_98A9_4585_BA1E_76226685392F"
      diagramType="ClassDiagram"
      owner="EAPK_8510AB1B_CCEC_4186_AAF7_EB9893025F80"
      toolName="Enterprise Architect 2.5"
    >
      <UML:ModelElement.taggedValue>
        <UML:TaggedValue tag="version" value="1.0"/>
        <UML:TaggedValue tag="author" value="HttpRen"/>
        <UML:TaggedValue tag="created_date" value="2024-10-04 05:42:06"/>
        <UML:TaggedValue tag="modified_date" value="2024-10-04 05:43:59"/>
        <UML:TaggedValue tag="package" value="EAPK_8510AB1B_CCEC_4186_AAF7_EB9893025F80"/>
        <UML:TaggedValue tag="type" value="Logical"/>
        <UML:TaggedValue 
          tag="swimlanes"
          value="locked=false;orientation=0;width=0;inbar=false;names=false;color=0;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;cls=0;SwimlaneFont=lfh:-13,lfw:0,lfi:0,lfu:0,lfs=0,lfface:Calibri,lfe=0,lfo=0,lfchar:1,lfop=0,lfcp=0,lfq=0,lfpf=0,lfWidth=0;"
        />
        <UML:TaggedValue 
          tag="matrixitems" 
          value="locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"
        />
        <UML:TaggedValue tag="ea_localid" value="83"/>
        <UML:TaggedValue 
          tag="EAStyle" 
          value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=0;HighlightForeign=0;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=827;DocSize.cy=1169;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.0;ExplicitNavigability=0;ShowShape=1;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"
        />
        <UML:TaggedValue 
          tag="styleex" 
          value="SaveTag=0F638E8A;ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;MatrixLocked=0;TConnectorNotation=UML 2.0;TExplicitNavigability=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ProfileData=;MDGDgm=;STBLDgm=;ShowNotes=0;VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;Theme=:119;"
        />
      </UML:ModelElement.taggedValue>

      <UML:Diagram.element>
        ${diagramElementsXML}
      </UML:Diagram.element>
    </UML:Diagram>
  </XMI.content>

  <XMI.difference/>
  <XMI.extensions xmi.extender="Enterprise Architect 2.5"/>
</XMI>`;

  return xml;
}
