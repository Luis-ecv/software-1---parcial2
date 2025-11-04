import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
// Use backend endpoints instead of Firestore
import Swal from "sweetalert2";
import BoardList from "../components/board/BoardList";
import BoardModals from "../components/board/BoardModals";

const useBoardState = () => {
  const [description, setDescription] = useState("");
  const [boardList, setBoardList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [editModalIsOpen, setEditModalIsOpen] = useState(false);
  const [inviteModalIsOpen, setInviteModalIsOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [xmlContent, setXmlContent] = useState(""); // Nuevo estado para XML

  return {
    description,
    setDescription,
    boardList,
    setBoardList,
    loading,
    setLoading,
    currentBoardId,
    setCurrentBoardId,
    modalIsOpen,
    setModalIsOpen,
    editModalIsOpen,
    setEditModalIsOpen,
    inviteModalIsOpen,
    setInviteModalIsOpen,
    inviteEmail,
    setInviteEmail,
    xmlContent,      // Añadir estas
    setXmlContent    // dos líneas
  };
};

const Board = () => {
  const navigate = useNavigate();
  const boardApiBase = `${import.meta.env.VITE_WS_URL || window.location.origin}/apis/sala`;

  const [user, setUser] = useState(null);
  const boardState = useBoardState();
  const {
    description,
    setDescription,
    boardList,
    setBoardList,
    loading,
    setLoading,
    currentBoardId,
    setCurrentBoardId,
    modalIsOpen,
    setModalIsOpen,
    editModalIsOpen,
    setEditModalIsOpen,
    inviteModalIsOpen,
    setInviteModalIsOpen,
    inviteEmail,
    setInviteEmail,
    xmlContent,        // Añadir estas
    setXmlContent     // dos líneas
  } = boardState;


  useEffect(() => {
    // Check session via backend profile
    let mounted = true;
    (async () => {
      try {
        const base = import.meta.env.VITE_WS_URL || window.location.origin;
        const url = `${base}/apis`;

        // First attempt: cookie-based credentialed request
        let res = await fetch(url, { credentials: 'include' });
        if (!mounted) return;

        // Parse payload carefully: backend sometimes wraps { error, data }
        let payload = await res.json().catch(() => null);

        // If we got a wrapper like { error, data } use payload.data
        let profile = payload && payload.data ? payload.data : payload;

        // If unauthorized or profile looks empty, try Authorization fallback using localStorage token
        if ((!res.ok || !profile || Object.keys(profile).length === 0) && res.status !== 200) {
          // try fallback token
          const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
          if (token) {
            res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            payload = await res.json().catch(() => null);
            profile = payload && payload.data ? payload.data : payload;
          }
        }

        if (!mounted) return;

        if (res.ok && profile && profile.id) {
          setUser({ email: profile.email, id: profile.id, name: profile.name || profile.fullname || profile.username });
          setLoading(false);
        } else {
          // Not authenticated - go to login
          setUser(null);
          navigate('/login');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setUser(null);
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const getBoardList = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`${boardApiBase}`, { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const status = res.status;
  const raw = await res.json().catch(() => null);
  // console.debug('getBoardList response status:', status, 'raw:', raw);
  if (!res.ok) {
        // If server returned 401/403, force logout or redirect
        if (status === 401 || status === 403) {
          navigate('/login');
          return;
        }
        throw new Error('Error fetching boards');
      }

      // Normalize rows to expected shape (id, title, description)
      // Backend returns { error: boolean, data: [] } so accept either that wrapper or a direct array
      const rows = Array.isArray(raw)
        ? raw
        : (raw && Array.isArray(raw.data) ? raw.data : (raw && Array.isArray(raw.rows) ? raw.rows : []));

      const normalized = rows.map(item => {
        // tolerate different casing and DB column names
        const id = item.id ?? item.pk ?? item.ID ?? item.Id ?? item.pk_id ?? item.PK;
        const title = item.title ?? item.description ?? item.name ?? item.titulo ?? item.Title;
        const descriptionField = item.description ?? item.title ?? item.descripcion ?? '';
        const host = item.host ?? item.userId ?? item.userid ?? item.user_id ?? item.userid ?? item.UserId;
        const participantes = item.participantes ?? item.participans ?? item.participants ?? [];
        return {
          id,
          title,
          description: descriptionField,
          host,
          participantes
        };
      });
  // console.debug('Normalized boards:', normalized);
      setBoardList(normalized || []);
    } catch (error) {
      console.error("Error al obtener tableros:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los tableros" });
      // ensure UI receives an array to avoid downstream crashes
      setBoardList([]);
    } finally {
      setLoading(false);
    }
  }, [user, setBoardList, boardApiBase]);

  useEffect(() => {
    if (user) {
      getBoardList();
    }
  }, [getBoardList, user]);

  useEffect(() => {
    if (xmlContent && user) {
      getBoardList();
    }
  }, [xmlContent, getBoardList, user]);




  // Modal actions
  const closeAllModals = useCallback(() => {
    setModalIsOpen(false);
    setEditModalIsOpen(false);
    setInviteModalIsOpen(false);
    setDescription("");
    setInviteEmail("");
  }, [setModalIsOpen, setEditModalIsOpen, setInviteModalIsOpen, setDescription, setInviteEmail]);

  // CRUD operations
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El nombre del tablero es obligatorio",
      });
      return;
    }

    try {
      const res = await fetch(boardApiBase, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // Backend expects `title` (required) and optional `description` and `xml`.
        body: JSON.stringify({ title: description, description })
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Create board failed:', res.status, result);
        const msg = result.message || (result.messages && result.messages.join(', ')) || 'No se pudo crear el tablero';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
        return;
      }

      // success
      await getBoardList();
      closeAllModals();

      Swal.fire({
        icon: "success",
        title: "¡Tablero creado!",
        text: "Tu tablero ha sido agregado exitosamente",
      });
    } catch (error) {
      console.error("Error al crear tablero:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo crear el tablero",
      });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El nombre del tablero es obligatorio",
      });
      return;
    }

    try {
      const res = await fetch(`${boardApiBase}/${currentBoardId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // Send title/description fields expected by backend
        body: JSON.stringify({ title: description, description, updatedAt: new Date() })
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Edit board failed:', res.status, result);
        const msg = result.message || (result.messages && result.messages.join(', ')) || 'No se pudo editar el tablero';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
        return;
      }

      await getBoardList();
      closeAllModals();

      Swal.fire({
        icon: "success",
        title: "¡Tablero actualizado!",
        text: "Tu tablero ha sido editado exitosamente",
      });
    } catch (error) {
      console.error("Error al editar tablero:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo editar el tablero",
      });
    }
  };

  const handleInviteUser = async (email) => {
    if (!email || !currentBoardId) return;

    try {
      const res = await fetch(`${boardApiBase}/${currentBoardId}`, { credentials: 'include' });
      const boardDoc = await res.json();
      if (!boardDoc) throw new Error("El tablero no existe");
      const currentParticipants = boardDoc.participantes || [];

      if (currentParticipants.includes(email)) {
        Swal.fire({
          icon: "warning",
          title: "Usuario ya invitado",
          text: "Este usuario ya tiene acceso al tablero",
        });
        return;
      }

      await fetch(`${boardApiBase}/${currentBoardId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantes: [...currentParticipants, email] })
      });

      Swal.fire({
        icon: "success",
        title: "¡Usuario invitado!",
        text: "El usuario ha sido invitado exitosamente",
      });

      closeAllModals();
    } catch (error) {
      console.error("Error al invitar usuario:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo invitar al usuario",
      });
    }
  };

  const handleDeleteBoard = async (boardId) => {
    try {
      const result = await Swal.fire({
        title: "¿Estás seguro?",
        text: "No podrás revertir esta acción",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
      });

      if (result.isConfirmed) {
    await fetch(`${boardApiBase}/${boardId}`, { method: 'DELETE', credentials: 'include' });
        await getBoardList();

        Swal.fire(
          "¡Eliminado!",
          "El tablero ha sido eliminado.",
          "success"
        );
      }
    } catch (error) {
      console.error("Error al eliminar tablero:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar el tablero",
      });
    }
  };

  const handleCopyLink = (boardId) => {
    const link = `${window.location.origin}/board/${boardId}`;
    navigator.clipboard.writeText(link);
    Swal.fire({
      icon: "success",
      title: "¡Enlace copiado!",
      text: "El enlace ha sido copiado al portapapeles",
      timer: 2000,
      showConfirmButton: false
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  // Manejar la carga del archivo XML
  const handleXmlUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      processXml(content);
    };
    reader.readAsText(file);
  };
  // Procesar el archivo XML
  const processXml = (xmlText) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Error al parsear el XML: " + parserError.textContent);
      }
  
      console.log("XML parseado:", xmlDoc);
  
      // Buscar todos los elementos packagedElement y filtrar
      const allPackaged = xmlDoc.getElementsByTagName("packagedElement");
      let classes = [];
  
      // Intentar encontrar clases dentro de paquetes
      for (let el of allPackaged) {
        if (el.getAttribute("xmi:type") === "uml:Package") {
          const pkgElements = el.getElementsByTagName("packagedElement");
          for (let child of pkgElements) {
            if (child.getAttribute("xmi:type") === "uml:Class") {
              classes.push(child);
            }
          }
        }
      }
  
      // Si no se encontraron clases en paquetes, buscar globalmente
      if (classes.length === 0) {
        for (let el of allPackaged) {
          if (el.getAttribute("xmi:type") === "uml:Class") {
            classes.push(el);
          }
        }
      }
  
      console.log("Clases encontradas:", classes.length);
  
      if (classes.length === 0) {
        throw new Error("No se encontraron clases en el XML");
      }
  
      const parsedNodes = classes.map((cls, index) => {
        const id = cls.getAttribute("xmi:id");
        const name = cls.getAttribute("name");
      
        // Espaciado mejorado entre nodos
        const position = {
          x: 250 + (index * 300), // Aumentado el espaciado horizontal
          y: 150 + (Math.floor(index / 2) * 250) // Distribución en filas
        };
      
        return {
          id: `node-${id}`,
          type: "classNode",
          position,
          data: {
            className: name,
            attributes: ["nuevoAtributo: string"],
            methods: ["nuevoMetodo(): void"]
          },
          dragging: false,
          selected: false,
          measured: {
            height: 186,
            width: 220
          }
        };
      });
      
      // Mejorar el procesamiento de relaciones
      const edges = [];
      
      // Procesar asociaciones y agregaciones
      const associations = Array.from(allPackaged).filter(el => {
        return el.getAttribute("xmi:type") === "uml:Association";
      });
      
      

      associations.forEach((assoc, index) => {
        const memberEnds = assoc.getElementsByTagName("ownedEnd");
        
        if (memberEnds.length === 2) {
          const source = memberEnds[0].getAttribute("type");
          const target = memberEnds[1].getAttribute("type");
          
          if (source && target) {
            // Solo ahora agrega a edges
          } else {
            console.error(`Relación inválida encontrada en el XML.`);
          }
        }
      });
            
      console.log("Relaciones encontradas:", edges.length);
      
      // Modificar la descripción del tablero importado
      const newBoardDescription = `Diagrama UML - ${parsedNodes[0].data.className} (${new Date().toLocaleDateString()})`;
      
      createBoardFromXml(newBoardDescription, parsedNodes, edges);
  
    } catch (error) {
      console.error("Error procesando XML:", error);
      Swal.fire({
        icon: "error",
        title: "Error al procesar el XML",
        text: error.message,
        showConfirmButton: true
      });
    }
  };
  // Crear el tablero con los datos procesados
  const createBoardFromXml = async (description, nodes, edges) => {
    try {
      // Crear el nuevo tablero con todos los datos necesarios
      await addDoc(boardCollection, {
        description,
        nodes,
        edges,
        host: user.email,
        participantes: [user.email],
        createdAt: new Date(),
        updatedAt: new Date()
      });
  
      Swal.fire({
        icon: "success",
        title: "¡Tablero creado!",
        text: `El tablero "${description}" ha sido importado correctamente`,
        showConfirmButton: false,
        timer: 2000
      });
  
      await getBoardList();
    } catch (error) {
      console.error("Error al crear el tablero:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo crear el tablero"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header con título y botones principales */}
        <div className="header-container">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Mis Tableros
          </h1>

          <div className="flex items-center gap-3">
            {/* Botón importar XML */}
            <label
              htmlFor="fileInput"
              className="btn-success cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar XML
            </label>
            <input
              type="file"
              id="fileInput"
              accept=".xml"
              onChange={handleXmlUpload}
              className="hidden"
            />

            {/* Botón nuevo tablero */}
            <button
              onClick={() => setModalIsOpen(true)}
              className="btn-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Tablero
            </button>
          </div>
        </div>

        {/* Contenedor principal de la lista de tableros */}
        <div className="card-container">
          <BoardList
            boards={boardList}
            user={user}
            onInvite={(id) => {
              setCurrentBoardId(id);
              setInviteModalIsOpen(true);
            }}
            onEdit={(board) => {
              setDescription(board.description);
              setCurrentBoardId(board.id);
              setEditModalIsOpen(true);
            }}
            onDelete={handleDeleteBoard}
          />
        </div>

        {/* Modales */}
        <BoardModals
          modalStates={{ modalIsOpen, editModalIsOpen, inviteModalIsOpen }}
          modalActions={{
            closeModal: () => setModalIsOpen(false),
            closeEditModal: () => setEditModalIsOpen(false),
            closeInviteModal: () => setInviteModalIsOpen(false)
          }}
          description={description}
          setDescription={setDescription}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          handleSubmit={handleSubmit}
          handleEditSubmit={handleEditSubmit}
          handleInviteUser={handleInviteUser}
          handleCopyLink={handleCopyLink}
          currentBoardId={currentBoardId}
        />
      </div>
    </div>
  );
};

export default Board;