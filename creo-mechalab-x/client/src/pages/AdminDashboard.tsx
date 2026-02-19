/* SECTION: IMPORTS & TYPES
   - USE: Defines the Admin interface and the data structure for Trainee credentials.
   - KEYPOINT: 'UserCredential' interface ensures every trainee has a unique ID, generated username, and password.
*/
import { useState } from 'react';
import { Users, Shield, Mail, Trash2, LogOut, Terminal, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';

interface UserCredential {
  id: number;
  name: string;
  email: string;
  username: string;
  password: string;
  validUntil: string;
  sent: boolean;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [inputData, setInputData] = useState('');
  const [generatedBatch, setGeneratedBatch] = useState<UserCredential[]>([]);
  const [isSending, setIsSending] = useState(false);

  /* SECTION: CREDENTIAL GENERATION LOGIC
     - USE: Creates secure, randomized 8-character passwords.
     - HOW IT WORKS: Pulls from a string of alphanumeric and special characters.
     - EDIT: To increase security, add more symbols or increase the length to 12+ characters.
  */
  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  /* SECTION: BATCH PROCESSING
     - USE: Converts raw text input (Name, Email) into structured system accounts.
     - KEYPOINT: Implements the "Last Name + Year + ID" username format.
     - HOW IT WORKS: Calculates a 25-day expiration date from the current moment of creation.
     - EDIT: Change the '25' in the Date logic if the training program duration changes.
  */
  const handleGenerate = () => {
    if (!inputData.trim()) return;

    const lines = inputData.split('\n').filter(line => line.includes(','));
    const today = new Date();
    const yearShort = today.getFullYear().toString().slice(-2);
    const expiryDate = new Date(today.setDate(today.getDate() + 25)).toISOString().split('T')[0];

    const newBatch = lines.map((line, index) => {
      const [fullName, email] = line.split(',').map(item => item.trim());
      const lastName = fullName.toUpperCase().split(' ').pop() || "USER";
      const traineeNumber = (index + 1).toString().padStart(3, '0');

      return {
        id: index + 1,
        name: fullName.toUpperCase(),
        email: email.toLowerCase(),
        username: `${lastName}${yearShort}${traineeNumber}`,
        password: generatePassword(),
        validUntil: expiryDate,
        sent: false
      };
    });

    setGeneratedBatch(newBatch);
  };

  /* SECTION: EMAIL DISPATCH SIMULATION
     - USE: Simulates sending the credentials to the trainee's email addresses.
     - HOW IT WORKS: Updates the local 'sent' state after a 2-second artificial delay.
     - EDIT: This section will eventually be replaced with an API call to a Node.js/SMTP backend.
  */
  const handleSendEmails = () => {
    setIsSending(true);
    setTimeout(() => {
      setGeneratedBatch(prev => prev.map(u => ({ ...u, sent: true })));
      setIsSending(false);
      alert("Credentials have been dispatched to trainee emails.");
    }, 2000);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">

        {/* SECTION: ADMIN HEADER
            - USE: Identity branding for the administrative console.
        */}
        <header className="border-b border-amber-900/30 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-2 rounded-lg border border-amber-500/50">
              <Shield className="text-amber-500 w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-wide">ADMIN <span className="text-amber-500">CONSOLE</span></h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Batch Management • Email Dispatch</p>
            </div>
          </div>
          <button onClick={() => navigate('/login')} className="p-2 hover:bg-red-900/20 rounded-full text-red-400 transition">
            <LogOut size={20} />
          </button>
        </header>

        <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* SECTION: DATA INPUT PANEL
              - USE: Allows Admin to paste mass trainee data for processing.
              - KEYPOINT: Format must be strictly followed (Name, Email) to trigger the generator.
          */}
          <div className="lg:col-span-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-amber-500" /> Trainee Entry
              </h2>

              <div className="space-y-4">
                <label className="text-xs font-mono text-slate-500 uppercase">
                  Format: Full Name, Email (One per line)
                </label>
                <textarea
                  className="w-full h-80 bg-slate-950 border border-slate-700 rounded p-3 text-sm font-mono text-cyan-400 focus:border-amber-500 outline-none resize-none"
                  placeholder="Juan Dela Cruz, juan@email.com&#10;Maria Santos, maria@email.com"
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                ></textarea>

                <button
                  onClick={handleGenerate}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-3 rounded flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Terminal size={18} /> Initialize Batch
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: RESULTS & DISPATCH PANEL
              - USE: Visual confirmation table of generated accounts before sending.
              - KEYPOINT: 'Dispatch Emails' button is disabled during the mock sending process.
          */}
          <div className="lg:col-span-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Mail className="text-amber-500" /> Distribution Queue
                </h2>
                {generatedBatch.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => setGeneratedBatch([])} className="p-2 text-slate-500 hover:text-red-400 transition">
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={handleSendEmails}
                      disabled={isSending}
                      className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded font-bold transition disabled:opacity-50"
                    >
                      {isSending ? "Sending..." : <><Send size={18} /> Dispatch Emails</>}
                    </button>
                  </div>
                )}
              </div>

              {generatedBatch.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase font-mono">
                        <th className="p-3">Trainee & Email</th>
                        <th className="p-3">Username</th>
                        <th className="p-3">Password</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-sm">
                      {generatedBatch.map((user) => (
                        <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                          <td className="p-3">
                            <div className="text-white font-bold">{user.name}</div>
                            <div className="text-slate-500 text-xs">{user.email}</div>
                          </td>
                          <td className="p-3 text-amber-400">{user.username}</td>
                          <td className="p-3 text-slate-400">{user.password}</td>
                          <td className="p-3 text-right">
                            {user.sent ?
                              <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded text-[10px] border border-green-400/20">SENT</span> :
                              <span className="text-slate-500 bg-slate-500/10 px-2 py-1 rounded text-[10px]">PENDING</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                  <Mail size={64} className="opacity-10 mb-4" />
                  <p className="font-bold">Queue Empty</p>
                  <p className="text-sm">Input trainee data to generate accounts.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;