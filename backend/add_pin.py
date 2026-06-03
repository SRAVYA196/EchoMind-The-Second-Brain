content = open('main.py', 'r').read()
if '/pin' not in content:
    route = '''
@app.patch("/thoughts/{thought_id}/pin")
async def pin_thought(thought_id: str):
    conn = get_db()
    row = conn.execute("SELECT pinned FROM thoughts WHERE id = ?", (thought_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    new_pinned = 0 if row["pinned"] else 1
    conn.execute("UPDATE thoughts SET pinned = ? WHERE id = ?", (new_pinned, thought_id))
    conn.commit()
    conn.close()
    return {"pinned": bool(new_pinned)}
'''
    open('main.py', 'a').write(route)
    print('Route added!')
else:
    print('Route already exists!')

